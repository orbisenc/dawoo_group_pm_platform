import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardApartmentPreview } from "./dashboard-apartment-preview";

describe("통합 대시보드 아파트 모델 미리보기", () => {
  it("WebGL을 사용할 수 없을 때 한국어 대체 안내를 제공한다", async () => {
    render(<DashboardApartmentPreview />);

    expect(screen.getByRole("region", { name: /아파트 101동 인터랙티브 3D 미리보기/ })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("WebGL과 하드웨어 가속");
    expect(screen.getByText(/마우스·한 손가락: 회전/)).toBeInTheDocument();
  });
});
