import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  email: string;
  processNumber: number;
  category: string;
  fileCount: number;
  note?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, processNumber, category, fileCount, note }: NotificationRequest = await req.json();

    console.log(`Sending notification email to ${email} for process #${processNumber}`);

    const emailResponse = await resend.emails.send({
      from: "Snap Manage Hub <onboarding@resend.dev>",
      to: [email],
      subject: `Upload abgeschlossen - Vorgang #${processNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">Upload erfolgreich abgeschlossen</h1>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #28a745; margin-top: 0;">Vorgang #${processNumber}</h2>
            <p><strong>Kategorie:</strong> ${category}</p>
            <p><strong>Anzahl Dateien:</strong> ${fileCount}</p>
            ${note ? `<p><strong>Notiz:</strong> ${note}</p>` : ''}
            <p><strong>Zeitpunkt:</strong> ${new Date().toLocaleString('de-DE')}</p>
          </div>

          <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              Diese E-Mail wurde automatisch generiert, um Sie über den erfolgreichen Upload zu informieren.
              Ihre Dateien wurden sicher in unserem System gespeichert.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6c757d; font-size: 12px;">
              © 2024 Snap Manage Hub - Alle Rechte vorbehalten
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);