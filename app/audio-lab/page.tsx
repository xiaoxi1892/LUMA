import { publicAsset } from "@/lib/publicAsset";
import Link from "next/link";
import "./style.css";

export const metadata = { title: "LUMA · 声音试听室" };
export default function AudioLab() {
  return (
    <main className="audio-lab">
      <header>
        <Link href="/">← 回到 LUMA</Link>
        <span>LUMA / AUDIO NOTES</span>
      </header>
      <h1>听见材料本身。</h1>
      <p className="lab-intro">
        这里是开发试听页。原始录音、处理片段和实测输出可以分开比较。所有播放器默认停止，建议从较低的系统音量开始。
      </p>
      <section>
        <h2>01 / 原始录音</h2>
        <article>
          <h3>刷子 · 混凝土表面</h3>
          <p>Joseph SARDIN · 19 秒 · CC0 · 真实现场录音</p>
          <audio
            controls
            preload="none"
            src={publicAsset("/audio/raw/brush-concrete-1107.wav")}
          />
          <a href="https://lasonotheque.org/brosse-sur-beton-s1107.html">
            查看原始来源与许可 ↗
          </a>
        </article>
        <article>
          <h3>细颗粒 · 沉降素材</h3>
          <p>
            Peludo · 颗粒脚步拟音 · CC0。来源使用木薯颗粒袋，非沙盘专门采录。
          </p>
          <audio controls preload="none" src={publicAsset("/audio/raw/sand-footsteps.mp3")} />
          <a href="https://opengameart.org/content/water-splash-and-sand-footsteps">
            查看原始来源与许可 ↗
          </a>
        </article>
      </section>
      <section>
        <h2>02 / 处理后的纹理</h2>
        <p>
          三个不同时间片段，单声道、低频清理、柔化尖峰和端点淡入淡出。播放器为素材本身的电平，沙盘引擎会进一步降低音量。
        </p>
        <div className="clip-list">
          {[1, 2, 3].map((i) => (
            <article key={i}>
              <h3>刷动 {String(i).padStart(2, "0")}</h3>
              <audio controls preload="none" src={publicAsset(`/audio/brush-${i}.wav`)} />
            </article>
          ))}
          <article>
            <h3>轻轻落下</h3>
            <audio controls preload="none" src={publicAsset("/audio/settle.wav")} />
          </article>
        </div>
      </section>
      <section>
        <h2>03 / Bubble · 柔软膜片</h2>
        <p>
          吸盘脱离塑料的实录拟音。三个不同动作片段，低通柔化后使用；不是沙盘音效变调。
        </p>
        <audio controls preload="none" src={publicAsset("/audio/raw/suction-1261.wav")} />
        <a href="https://lasonotheque.org/ventouse-sur-plastique-s1261.html">
          Joseph SARDIN · 原始录音与 CC0 许可 ↗
        </a>
        <div className="clip-list">
          {[1, 2, 3].map((i) => (
            <article key={i}>
              <h3>膜片 {i}</h3>
              <audio controls preload="none" src={publicAsset(`/audio/cell-${i}.wav`)} />
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>04 / Beads · 玻璃微碰撞</h2>
        <p>
          玻璃珠在瓷砖上弹跳的实录。使用短促碰撞和后段连续小跳纹理。互动引擎每个窗口汇总碰撞能量，最多三个短声部。
        </p>
        <audio controls preload="none" src={publicAsset("/audio/raw/glass-ball-2240.wav")} />
        <a href="https://bigsoundbank.com/glass-ball-bounce-1-s2240.html">
          Joseph SARDIN · 原始录音与 CC0 许可 ↗
        </a>
        <div className="clip-list">
          {[1, 2, 3].map((i) => (
            <article key={i}>
              <h3>微碰撞 {i}</h3>
              <audio controls preload="none" src={publicAsset(`/audio/bead-${i}.wav`)} />
            </article>
          ))}
          <article>
            <h3>连续小跳纹理</h3>
            <audio controls preload="none" src={publicAsset("/audio/bead-roll.wav")} />
          </article>
        </div>
      </section>
      <section>
        <h2>05 / 沙盘实测输出 · 20 秒</h2>
        <p>
          来自沙盘内真实操作的音频总线录制。梳动、停顿、切换工具和松手都保留在其中。未录制麦克风或环境声音。
        </p>
        <audio controls preload="none" src={publicAsset("/audio/interaction-mix.webm")} />
        <div className="lab-links">
          <a href={publicAsset("/audio/interaction-mix.webm")} download>
            下载声音
          </a>
          <a href={publicAsset("/captures/interaction-video.webm")} >查看实际操作视频</a>
          <Link href="/?inspect=1">自行录制一段 →</Link>
        </div>
      </section>
      <section>
        <h2>06 / 材质切换实测 · 20 秒</h2>
        <p>
          来自实际磁珠甩动、膜片划压与材质切换的画布及音频总线录制，包含停顿。画布录制不包含网页
          UI 与 CSS 背景。
        </p>
        <audio controls preload="none" src={publicAsset("/audio/materials-mix.webm")} />
        <div className="lab-links">
          <a href={publicAsset("/audio/materials-mix.webm")} download>
            下载声音
          </a>
          <a href={publicAsset("/captures/materials-video.webm")} >查看材质变化视频</a>
        </div>
      </section>
      <footer>
        自动检查覆盖解码、峰值、声部数量和暂停逻辑；不替代人的试听。舒适度、材质相似度与长时间聆听感受仍需你来判断。
        <p>
          Additional sounds: Joseph SARDIN · LaSonotheque / BigSoundBank,
          charlesdu76, Peludo · <a href="https://rnan.itch.io/">RNAn</a>. CC0.
        </p>
      </footer>
    </main>
  );
}
