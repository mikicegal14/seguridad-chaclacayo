/**
 * Script de diagnóstico y verificación de conectividad con Amazon S3
 * Uso: node scripts/test-s3.js
 */
require('dotenv').config();
const { 
  S3Client, 
  HeadBucketCommand, 
  PutObjectCommand, 
  DeleteObjectCommand 
} = require('@aws-sdk/client-s3');

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.S3_BUCKET_MEDIA;
const cloudfrontUrl = process.env.CLOUDFRONT_MEDIA_URL;

console.log('===============================================================');
console.log('       DIAGNÓSTICO DE ALMACENAMIENTO AWS S3 - PRODUCCIÓN      ');
console.log('===============================================================');
console.log(`[Config] NODE_ENV:              ${process.env.NODE_ENV || 'development'}`);
console.log(`[Config] AWS_REGION:            ${region}`);
console.log(`[Config] S3_BUCKET_MEDIA:       ${bucketName || '(NO DEFINIDO)'}`);
console.log(`[Config] CLOUDFRONT_MEDIA_URL:  ${cloudfrontUrl || '(NO DEFINIDO)'}`);
console.log(`[Config] Credenciales estáticas: ${process.env.AWS_ACCESS_KEY_ID ? 'Sí (AWS_ACCESS_KEY_ID configurado)' : 'No (Usando IAM Role / Metadata EC2)'}`);
console.log('---------------------------------------------------------------');

if (!bucketName) {
  console.error('❌ ERROR FATAL: La variable S3_BUCKET_MEDIA no está definida en tu archivo .env.');
  console.error('   Sin esta variable, el sistema guardará las imágenes en disco local (/uploads)');
  console.error('   y los usuarios de CloudFront NO podrán ver las fotos.');
  console.error('');
  console.error('👉 Solución: Agrega a tu archivo .env:');
  console.error('   S3_BUCKET_MEDIA=seguridad-chaclacayo-media-XXXXXX');
  console.error('   AWS_REGION=us-east-1');
  console.error('===============================================================');
  process.exit(1);
}

const clientConfig = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  };
}

const s3 = new S3Client(clientConfig);

async function runDiagnostics() {
  const testKey = `uploads/test-s3-${Date.now()}.txt`;
  const testPayload = `Verificación de conectividad S3 Seguridad Chaclacayo - ${new Date().toISOString()}`;

  try {
    // Paso 1: Verificar existencia y acceso al bucket
    console.log(`[Paso 1/3] Verificando acceso al bucket '${bucketName}'...`);
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    console.log('  ✅ Acceso al bucket verificado exitosamente.');

    // Paso 2: Probar subida de objeto (PutObject)
    console.log(`[Paso 2/3] Probando subida de archivo de prueba (${testKey})...`);
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: Buffer.from(testPayload, 'utf-8'),
      ContentType: 'text/plain'
    }));
    console.log('  ✅ Subida exitosa (PutObject completado).');

    // Paso 3: Probar eliminación de objeto de prueba (DeleteObject)
    console.log(`[Paso 3/3] Limpiando archivo de prueba (${testKey})...`);
    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey
    }));
    console.log('  ✅ Eliminación exitosa (DeleteObject completado).');

    console.log('---------------------------------------------------------------');
    console.log('🎉 ¡DIAGNÓSTICO EXITOSO! AWS S3 está 100% operativo.');
    console.log('   Las evidencias e imágenes de las alertas se subirán correctamente a S3.');
    if (cloudfrontUrl) {
      console.log(`   CloudFront servirá las imágenes bajo: ${cloudfrontUrl}/uploads/...`);
    }
    console.log('===============================================================');
    process.exit(0);

  } catch (error) {
    console.error('---------------------------------------------------------------');
    console.error('❌ FALLÓ EL DIAGNÓSTICO CON AWS S3:');
    console.error(`   Error Code:    ${error.name || 'Unknown'}`);
    console.error(`   Mensaje:       ${error.message}`);
    console.error('');

    if (error.name === 'CredentialsProviderError' || error.message.includes('credential')) {
      console.error('💡 Causa probable:');
      console.error('   Si estás en un contenedor Docker sobre EC2, IMDSv2 bloqueó la petición.');
      console.error('   Asegúrate de que la instancia EC2 tenga `http_put_response_hop_limit = 2`');
      console.error('   o pasa credenciales explícitas en el archivo .env.');
    } else if (error.name === 'NoSuchBucket' || error.$metadata?.httpStatusCode === 404) {
      console.error('💡 Causa probable:');
      console.error(`   El bucket '${bucketName}' no existe en AWS o el nombre está mal escrito.`);
    } else if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
      console.error('💡 Causa probable:');
      console.error('   El rol IAM o las credenciales no tienen permisos (s3:PutObject, s3:DeleteObject, s3:ListBucket).');
    }
    console.error('===============================================================');
    process.exit(1);
  }
}

runDiagnostics();
