import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const licenseKey = process.env.SYNCFUSION_LICENSE_KEY;

    if (!licenseKey) {
      console.error('SYNCFUSION_LICENSE_KEY is not defined');
      return NextResponse.json(
        { error: 'License key configuration error' },
        { status: 500 }
      );
    }

    return NextResponse.json({ key: licenseKey });
  } catch (error) {
    console.error('Error fetching license key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}