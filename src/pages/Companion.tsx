import GuideSection from "@/components/companion/GuideSection";

/**
 * 伴学师（/companion）：只保留七步法导学。
 * 我的档案 / 学习成绩 → 测评报告（/report-detail?tab=profile）；
 * 课堂录音 → 查漏补缺（/gaps 的「课堂录音」页签）。
 */
export default function Companion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-olive">伴学师 · 七步法导学</h1>
        <p className="mt-1 text-[15px] text-olive-soft">
          按七步法走完每一堂课——学习的方法，比学习的时长更值钱。
        </p>
      </div>
      <GuideSection />
    </div>
  );
}
