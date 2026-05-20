'use client'

import { useChat } from '@ai-sdk/react'
import { type UIMessage } from 'ai'
import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { AlertCircle } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useEditor } from '@/contexts/EditorContext'

import { AskClarificationWizard } from './tools/AskClarificationWizard'
import { useResizable } from './hooks/useResizable'
import { ChatMessageItem, HIDDEN_ANALYZE_PROMPT } from './components/ChatMessageItem'
import { ChatInputForm } from './components/ChatInputForm'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ==================== Main ChatPanel ====================
interface ChatPanelProps {
  documentId: string;
  editorContext: string;
  isNewDocument?: boolean;
  initialPrompt?: string;
  isUploaded?: boolean;
  isReady?: boolean;
}

const ChatPanel = forwardRef<{ sendMessage: (msg: { text: string }) => void }, ChatPanelProps>(({ 
  documentId,
  editorContext,
  isNewDocument = false,
  initialPrompt,
  isUploaded = false,
  isReady = false
}, ref) => {
  const { selectedHtml, selectedText, editorRef } = useEditor()
  const [showHistoryError, setShowHistoryError] = useState(false)

  const hasInitializedAnalyizeRef = useRef(false)
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false)
  const processedAutoCalls = useRef<Set<string>>(new Set())

  const { width, isResizing, setIsResizing } = useResizable()
  const [input, setInput] = useState('')

  const truncatedContext = useMemo(() => {
    if (!editorContext) return '';
    const MAX_LENGTH = 15000;
    
    if (editorContext.length <= MAX_LENGTH) return editorContext;

    // 15,000자에서 자르되, 가장 가까운 이전 문단 끝(\n)을 찾음
    const slice = editorContext.slice(0, MAX_LENGTH);
    const lastNewline = slice.lastIndexOf('\n');
    
    // 적절한 줄바꿈 위치를 찾으면 거기서 자르고, 아니면 그냥 slice
    const finalTrim = lastNewline > MAX_LENGTH * 0.8 ? slice.slice(0, lastNewline) : slice;
    
    return finalTrim + '\n...(이하 생략)';
  }, [editorContext])

  const selectedHtmlRef = useRef(selectedHtml);
  const selectedTextRef = useRef(selectedText);
  const truncatedContextRef = useRef(truncatedContext);

  useEffect(() => {
    selectedHtmlRef.current = selectedHtml;
    selectedTextRef.current = selectedText;
    truncatedContextRef.current = truncatedContext;
  }, [selectedHtml, selectedText, truncatedContext]);

  const chatHelpers = useChat({
    id: documentId,
    generateId: () => crypto.randomUUID(),
    onError: (err) => {
      alert('챗 서버와의 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      console.error('Chat error:', err);
    },
    // DB Full Sync는 현재 클라이언트에서 isSyncOnly 플래그를 통해 명시적으로 트리거됨
  })

  const {
    messages,
    status,
    addToolResult,
    setMessages,
  } = chatHelpers

  // @ts-expect-error append is available in newer ai versions or fallback to sendMessage
  const append = (chatHelpers.append || chatHelpers.sendMessage) as any

  const isStreaming = status === 'submitted' || status === 'streaming'

  // 에이전트별 가장 마지막(최신) toolCallId를 계산하여 중복 렌더링 방지
  const latestProgressByAgent = useMemo(() => {
    const latest: Record<string, string> = {};
    messages.forEach((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      m.parts?.forEach((part: any) => {
        const toolName = part.toolInvocation?.toolName || part.toolName || (part.type.startsWith('tool-') ? part.type.replace('tool-', '') : '');
        if (toolName === 'planDocument' || toolName === 'writeDocument' || toolName === 'reviewDocument') {
          latest[toolName] = part.toolInvocation?.toolCallId || part.toolCallId;
        }
      });
    });
    return latest;
  }, [messages]);

  const pendingClarificationCall = useMemo(() => {
    if (messages.length === 0) return null;
    const lastMessage = messages[messages.length - 1];
    
    // 오직 마지막 메시지가 assistant일 때만 위저드를 렌더링함
    if (lastMessage.role !== 'assistant') return null;

    const pendingPart = lastMessage.parts?.find((part: any) => {
      const inv = part.toolInvocation || part;
      const toolName = inv.toolName || (part.type?.startsWith('tool-') ? part.type.replace('tool-', '') : '');
      return toolName === 'askClarification' && inv.result === undefined && inv.output === undefined;
    });

    return pendingPart ? ((pendingPart as any).toolInvocation || pendingPart) : null;
  }, [messages]);

  const hasPendingTool = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return false;

    return lastMessage.parts?.some((part: any) => {
      if (!part.type?.startsWith('tool-')) return false;
      const inv = part.toolInvocation || part;
      if (inv.toolName === 'reportProgress') return false;
      return inv.result === undefined && inv.output === undefined;
    }) || false;
  }, [messages]);

  useImperativeHandle(ref, () => ({
    sendMessage: (msg: { text: string }) => {
      append(
        { role: 'user', parts: [{ type: 'text', text: msg.text }] }, 
        {
          body: {
            documentId,
            selectedHtml,
            selectedText,
            editorContext: truncatedContext, // 꼼수 최적화 폐기: 무조건 보냄
            isNewDocument // 새 문서 여부 명시적 전달
          }
        }
      );
    }
  }));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    if (hasPendingTool) {
      messages.forEach((m: UIMessage) => {
        m.parts?.forEach((part: any) => {
          const inv = part.toolInvocation || part;
          if (part.type.startsWith('tool-') && inv.result === undefined && inv.output === undefined) {
            addToolResult({
              toolCallId: inv.toolCallId,
              result: '사용자가 도구 사용을 무시하고 새로운 채팅을 입력하여 실행이 취소되었습니다.',
              tool: inv.toolName || part.type.replace('tool-', ''),
              output: '사용자가 도구 사용을 무시하고 새로운 채팅을 입력하여 실행이 취소되었습니다.'
            } as any)
          }
        })
      })
    }

    append(
      { role: 'user', parts: [{ type: 'text', text: input }] }, 
      {
        body: {
          documentId,
          selectedHtml,
          selectedText,
          editorContext: truncatedContext, // 꼼수 최적화 폐기: 무조건 보냄
          isNewDocument // 새 문서 여부 명시적 전달
        }
      }
    )
    setInput('')
  }

  // 채팅 히스토리 불러오기
  useEffect(() => {
    const fetchHistory = async () => {
      if (!documentId) {
        setIsHistoryLoaded(true);
        return;
      }
      
      // 새 문서이고 파일 업로드도 아니면 기존 채팅 기록 없음
      if (isNewDocument && !isUploaded) {
        setIsHistoryLoaded(true);
        return;
      }
      
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const uiMessages: UIMessage[] = data.map(m => {
            let parsedParts;
            try {
              // content가 JSON 형식(parts 배열)인지 확인하고 파싱 시도
              parsedParts = JSON.parse(m.content);
              // 만약 배열이 아니면 단순 텍스트로 처리
              if (!Array.isArray(parsedParts)) {
                parsedParts = [{ type: 'text', text: m.content }];
              }
            } catch (e) {
              // 파싱 실패(기존 데이터처럼 단순 텍스트인 경우) 하위 호환성 유지
              parsedParts = [{ type: 'text', text: m.content }];
            }

            return {
              id: m.id,
              role: m.role as 'user' | 'assistant',
              parts: parsedParts
            };
          });
          setMessages(uiMessages);
          hasInitializedAnalyizeRef.current = true;
        }
      } catch (err) {
        console.error('Failed to fetch chat history:', err);
        setShowHistoryError(true);
        setTimeout(() => setShowHistoryError(false), 3000);
      } finally {
        setIsHistoryLoaded(true);
      }
    };

    fetchHistory();
  }, [documentId, isNewDocument, isUploaded, setMessages]);

  useEffect(() => {
    if (!isHistoryLoaded || !isReady) return;
    if (messages.length > 0 || hasInitializedAnalyizeRef.current) return;

    hasInitializedAnalyizeRef.current = true

    if (initialPrompt) {
      setTimeout(() => {
        append(
          { role: 'user', parts: [{ type: 'text', text: initialPrompt }] }, 
          { body: { documentId, selectedHtml, selectedText, editorContext: truncatedContext, isNewDocument } }
        );
      }, 500)
    } else if (isUploaded) {
      console.log('[DEBUG-CHAT] HIDDEN_ANALYZE_PROMPT 전송 시도.');
      setTimeout(() => {
        append(
          { role: 'user', parts: [{ type: 'text', text: HIDDEN_ANALYZE_PROMPT }] }, 
          { body: { documentId, selectedHtml, selectedText, editorContext: truncatedContext, isNewDocument } }
        );
      }, 800)
    } else {
      // 1. 기존 문서 재진입 시 (채팅 이력 있음): 
      // 추가 인사말을 렌더링하지 않고 입력창의 placeholder를 통해 조용히 안내합니다.
      // 2. 완전 새로운 빈 문서인 경우: 
      // 인사말을 출력하고, 이를 영구적으로 남기기 위해 DB에 바로 저장합니다.
      if (isNewDocument && messages.length === 0) {
        const greetingText = '새로운 문서를 시작하시네요! 👋\n\n어떤 종류의 문서를 작성하실 계획인가요?\n(예: IT 서비스 사업계획서, 주간 운영 보고서, 제안서, 기획안 등)';
        const initialGreetingId = crypto.randomUUID();
        
        setMessages([
          {
            id: initialGreetingId,
            role: 'assistant',
            parts: [{ type: 'text', text: greetingText }],
          } as UIMessage
        ]);

        // 초기 인사말을 DB에 즉시 저장
        if (documentId) {
          import('@/lib/supabase/client').then(({ createClient }) => {
            const supabase = createClient();
            supabase.from('chat_messages').insert({
              id: initialGreetingId,
              document_id: documentId,
              role: 'assistant',
              content: JSON.stringify([{ type: 'text', text: greetingText }]),
            }).then(({ error }) => {
              if (error) console.error('[초기 인사말 저장 실패]', error);
            });
          });
        }
      }
    }
  }, [isHistoryLoaded, isReady, messages.length, isNewDocument, isUploaded, setMessages, initialPrompt, append, selectedHtml, selectedText, truncatedContext])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ✨ 클라이언트 오케스트레이션 및 자동 강제 동기화 (Auto-Save)
  // 스트리밍이 종료되고 화면 상태가 안정화되었을 때, 이 최신 상태를 무조건 DB에 동기화합니다.
  useEffect(() => {
    if (isStreaming || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    // 1. 상태 안정화 시 강제 동기화 핑 (isSyncOnly)
    // AI의 스트리밍이 끝나고 도구 상태(call -> result)가 확정된 이 시점의 완벽한 messages 배열을 서버에 밀어넣습니다.
    if (documentId) {
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          messages,
          isSyncOnly: true // AI 답변 생성 없이 DB Full Sync만 수행
        })
      }).catch(err => console.error('[Auto-Save 동기화 실패]', err));
    }

    // ✨ planDocument 완료 확인 시 조용히 서버 트리거
    const planPart = lastMessage.parts?.find((p: any) => {
      const inv = p.toolInvocation || p;
      const toolName = inv.toolName || (p.type?.startsWith('tool-') ? p.type.replace('tool-', '') : '');
      const isCompleted = p.state === 'result' || inv.state === 'result' || inv.result !== undefined || p.state === 'output-available' || inv.state === 'output-available' || inv.output !== undefined;
      return toolName === 'planDocument' && isCompleted;
    });

    if (planPart) {
      const inv = (planPart as any).toolInvocation || planPart;
      const toolCallId = inv.toolCallId;
      
      if (!processedAutoCalls.current.has(toolCallId)) {
        // 혹시 이미 작성 단계가 발동되었는지 안전 확인
        const hasWriteDocument = messages.some(m => 
          m.parts?.some((p: any) => {
            const i = p.toolInvocation || p;
            const tName = i.toolName || (p.type?.startsWith('tool-') ? p.type.replace('tool-', '') : '');
            return tName === 'writeDocument';
          })
        );

        if (!hasWriteDocument) {
          processedAutoCalls.current.add(toolCallId);
          console.log('[DEBUG-ORCHESTRATION] planDocument 완료 확인. 서버 사이드 도구 강제를 위한 투명 트리거 진행.');
          setTimeout(() => {
            append(
              { role: 'user', parts: [{ type: 'text', text: '[SYSTEM_AUTO_TRIGGER: writeDocument] 기획안을 바탕으로 초안 작성을 시작하세요.' }] }, 
              {
                body: {
                  documentId,
                  selectedHtml: selectedHtmlRef.current,
                  selectedText: selectedTextRef.current,
                  editorContext: truncatedContextRef.current,
                  isNewDocument
                }
              }
            );
          }, 500);
        }
      }
    }

    // ✨ writeDocument 완료 감지 후 에디터에 자동 덮어쓰기 트리거
    const writePart = lastMessage.parts?.find((p: any) => {
      const inv = p.toolInvocation || p;
      const toolName = inv.toolName || (p.type?.startsWith('tool-') ? p.type.replace('tool-', '') : '');
      const isCompleted = p.state === 'result' || inv.state === 'result' || inv.result !== undefined || p.state === 'output-available' || inv.state === 'output-available' || inv.output !== undefined;
      return toolName === 'writeDocument' && isCompleted;
    });

    if (writePart && editorRef?.current) {
      const inv = (writePart as any).toolInvocation || writePart;
      const toolCallId = inv.toolCallId;
      const args = inv.args || inv.input;
      
      if (args?.htmlContent && !processedAutoCalls.current.has(toolCallId)) {
        processedAutoCalls.current.add(toolCallId); // fix typo from has -> add
        console.log('[DEBUG-ORCHESTRATION] writeDocument 완료 확인. 에디터에 직접 HTML 덮어쓰기 진행.');
        editorRef.current.loadDocument(args.htmlContent); // Changed from replaceSelection to loadDocument for whole document update
      }
    }
  }, [isStreaming, messages, append, documentId, isNewDocument, editorRef]);

  // 디버깅: 현재 messages 배열의 상태를 콘솔에 출력 (제거됨)
  // useEffect(() => {
  //   if (messages.length > 0) {
  //     console.log('[DEBUG-MESSAGES]', JSON.stringify(messages, null, 2));
  //   }
  // }, [messages])

  return (
    <div 
      className="relative flex-shrink-0 flex flex-col h-full border-l bg-gray-50"
      style={{ width: `${width}px` }}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 transition-colors",
          isResizing ? "bg-blue-500" : "hover:bg-blue-300"
        )}
        onMouseDown={(e) => {
          e.preventDefault()
          setIsResizing(true)
        }}
      />
      
      <div className="p-4 border-b bg-white font-bold text-gray-700 relative">
        AI 문서 도우미
        
        {/* 히스토리 로드 실패 배너 */}
        {showHistoryError && (
          <div className="absolute top-full left-0 right-0 bg-yellow-50 border-b border-yellow-100 p-2 flex items-center gap-2 text-[11px] text-yellow-800 z-10 animate-in slide-in-from-top duration-300">
            <AlertCircle size={14} className="text-yellow-600 shrink-0" />
            <span>대화 기록을 불러오지 못했습니다. 새 대화로 시작합니다.</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m: UIMessage) => (
          <ChatMessageItem 
            key={m.id} 
            message={m} 
            latestProgressByAgent={latestProgressByAgent} 
            addToolResult={addToolResult} 
          />
        ))}

        {/* 🚨 [방어막 3] 위저드가 활성화되어 사용자의 답변을 기다리는 상태라면, 
            뒤이어 쏟아지는 스트리밍 데이터(병렬 툴 껍데기 등)에 반응하여 
            "답변 중" 로딩 상태가 뜨지 않도록 조건을 강화합니다. */}
        {(status === 'submitted' || status === 'streaming') && messages.length > 0 && !pendingClarificationCall && (
          <div className={cn(
            "max-w-[85%] p-3 rounded-lg bg-white border self-start shadow-sm animate-in fade-in duration-300",
            status === 'streaming' && "border-blue-100 bg-blue-50/30"
          )}>
            <div className="flex items-center gap-3 text-gray-500">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></span>
              </div>
              <span className="text-xs font-medium text-blue-700">
                {messages.length === 1 ? '문서의 구조와 내용을 정밀 분석하고 있습니다...' : 'AI가 답변을 작성 중입니다...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ✨ Quick Reply Wizard (askClarification 연동) */}
      {pendingClarificationCall && ((pendingClarificationCall as any).args || (pendingClarificationCall as any).input) && (
        <AskClarificationWizard
          args={(pendingClarificationCall as any).args || (pendingClarificationCall as any).input}
          toolCallId={(pendingClarificationCall as any).toolCallId || 'unknown'}
          // @ts-expect-error fallback for addToolResult type
          addToolResult={addToolResult}
          append={append}
          editorContext={truncatedContext}
          selectedHtml={selectedHtml}
          selectedText={selectedText}
        />
      )}

      <ChatInputForm
        input={input}
        isStreaming={isStreaming}
        hasPendingTool={hasPendingTool}
        selectedText={selectedText}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
      />
    </div>
  )
})

export default ChatPanel;