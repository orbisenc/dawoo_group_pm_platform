import { BadRequestException, Injectable } from "@nestjs/common";

@Injectable()
export class InputSecurityService {
  plainText(value: string, fieldName: string) {
    const normalized = value.normalize("NFKC").trim();
    if (!normalized) throw new BadRequestException(`${fieldName}을(를) 입력해 주세요.`);
    if (/<\s*\/?\s*[a-z][^>]*>/iu.test(normalized)) throw new BadRequestException(`${fieldName}에는 HTML을 사용할 수 없습니다.`);
    for (const character of normalized) {
      const code = character.charCodeAt(0);
      if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) throw new BadRequestException(`${fieldName}에 허용되지 않는 제어 문자가 있습니다.`);
    }
    return normalized;
  }

  tags(tags: string[] | undefined) {
    return [...new Set((tags ?? []).map((tag) => tag.normalize("NFKC").trim().toLowerCase()))];
  }

  fileName(value: string) {
    const name = this.plainText(value, "파일명");
    if (name.includes("/") || name.includes("\\") || name === "." || name === "..") throw new BadRequestException("올바른 파일명을 입력해 주세요.");
    return name;
  }
}
