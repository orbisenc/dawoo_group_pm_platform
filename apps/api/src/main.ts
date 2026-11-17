import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>("API_PORT", 4000);
  const webOrigin = config.get<string>("WEB_ORIGIN", "http://localhost:3004");

  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: webOrigin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const openApiConfig = new DocumentBuilder()
    .setTitle("PROJECT HUB API")
    .setDescription("건설 개발사업 협업 플랫폼 API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, openApiConfig));

  await app.listen(port);
  console.log(`PROJECT HUB API가 http://localhost:${port}/api/v1 에서 실행 중입니다.`);
}

void bootstrap();
