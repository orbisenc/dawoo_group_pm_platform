import { BadRequestException } from "@nestjs/common";

import { InputSecurityService } from "./input-security.service";

describe("InputSecurityService", () => {
  const security = new InputSecurityService();

  it("일반 텍스트를 정규화하고 앞뒤 공백을 제거한다", () => {
    expect(security.plainText("  현장 검토 요청  ", "제목")).toBe("현장 검토 요청");
  });

  it.each(["<script>alert(1)</script>", "<img src=x onerror=alert(1)>"])("HTML 입력을 거부한다: %s", (value) => {
    expect(() => security.plainText(value, "내용")).toThrow(BadRequestException);
  });

  it("경로를 포함한 파일명을 거부한다", () => {
    expect(() => security.fileName("../../secret.pdf")).toThrow(BadRequestException);
  });

  it("태그를 정규화하고 중복을 제거한다", () => {
    expect(security.tags(["BIM", "bim", " 구조검토 "])).toEqual(["bim", "구조검토"]);
  });
});
