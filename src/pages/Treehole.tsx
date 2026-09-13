import { HeartHandshake } from "lucide-react";
import TalkForm from "@/components/treehole/TalkForm";
import WeekMoodBars from "@/components/treehole/WeekMoodBars";
import HistoryList from "@/components/treehole/HistoryList";

export default function Treehole() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-olive">
          <HeartHandshake size={24} className="text-lime" />
          树洞心情
        </h1>
        <p className="mt-1 text-[15px] text-olive-soft">
          开心的、烦的、说不出口的，都可以放在这里。树洞会认真听，也会给你回信。
        </p>
      </div>

      <TalkForm />

      <WeekMoodBars />

      <div>
        <div className="mono mb-2.5 text-[11px] tracking-wider text-olive-mute">以前说过的话</div>
        <HistoryList />
      </div>

      <p className="pb-2 text-center text-[12px] leading-relaxed text-olive-mute">
        树洞说的每句话只有你知道。如果烦恼很重，也试试告诉家长或老师，好吗？
      </p>
    </div>
  );
}
