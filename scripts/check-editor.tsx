/** @jsxImportSource react */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AcademicsEditorCore from "../src/components/companion/AcademicsEditorCore";
const html = renderToStaticMarkup(React.createElement(AcademicsEditorCore, {
  grade: "初一",
  initial: { examName: "期中", subjects: [{ name: "数学", selfLevel: 3, fullScore: 120, lastScore: 100, targetScore: 112 }], updatedAt: 1 } as any,
  onSubmit: () => {},
}));
for (const kw of ["学科自评与目标", "最近大考名称", "目标分数", "保存"]) {
  if (!html.includes(kw)) throw new Error("缺关键词: " + kw);
}
console.log("EDITOR_OK", html.length);
