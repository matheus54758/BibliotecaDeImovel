import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Lida com requisições CORS do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { filename, fileType } = await req.json();

    if (!filename || !fileType) {
      throw new Error('Parâmetros "filename" e "fileType" são obrigatórios');
    }

    // Configurações do R2 (Você precisará adicionar essas chaves nas secrets do Supabase)
    const accountId = Deno.env.get('R2_ACCOUNT_ID') || '';
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID') || '';
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY') || '';
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || '';

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('Credenciais do Cloudflare R2 não estão configuradas nas secrets da função.');
    }

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filename,
      ContentType: fileType,
    });

    // Gera uma URL assinada temporária (válida por 5 minutos)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    // Pega o domínio público configurado para gerar o link final do arquivo
    // Ex: https://pub-xxxxxxxxx.r2.dev
    const publicUrlDomain = Deno.env.get('R2_PUBLIC_URL') || '';
    const publicUrl = `${publicUrlDomain}/${filename}`;

    return new Response(JSON.stringify({ signedUrl, publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
