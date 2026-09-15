"""Reproducible edits of the credited CC0 recordings; no generated noise or tones.
Requires numpy + scipy; decode the credited MP3 with macOS afconvert first.
"""
from pathlib import Path
import wave, json
import numpy as np
from scipy.signal import butter, sosfiltfilt
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio'

def read(p):
    with wave.open(str(p),'rb') as f:
        rate=f.getframerate(); channels=f.getnchannels()
        samples=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').astype(np.float64)/32768
    return samples.reshape(-1,channels).mean(axis=1),rate

def write(name,data,rate):
    with wave.open(str(OUT/name),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate)
        f.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())

def soften(x,rate):
    x=x-x.mean()
    x=sosfiltfilt(butter(2,[170,4800],btype='bandpass',fs=rate,output='sos'),x)
    # Modest peak shaping; avoid normalising a quiet fragment into loud hiss.
    x=np.tanh(x*2.0)/2.0
    peak=np.max(np.abs(x))
    x*=min(2.5,0.32/max(peak,0.00001))
    fade=min(int(rate*.08),len(x)//3)
    x[:fade]*=np.sin(np.linspace(0,np.pi/2,fade))**2
    x[-fade:]*=np.sin(np.linspace(np.pi/2,0,fade))**2
    return x

brush,rate=read(OUT/'raw/brush-concrete-1107.wav')
report=[]
for i,start in enumerate([1.8,7.1,13.2]):
    raw=brush[int(start*rate):int((start+4.4)*rate)]
    x=soften(raw,rate)
    name=f'brush-{i+1}.wav';write(name,x,rate)
    report.append(dict(file=name,sourceStart=start,duration=len(x)/rate,peakDb=round(20*np.log10(max(abs(x))),2),rmsDb=round(20*np.log10(np.sqrt(np.mean(x*x))),2)))
sand,sr=read(Path('/tmp/luma-sand-mono.wav'))
# A low-material movement tail, not a synthetic pop.
start=int(2.6*sr);x=soften(sand[start:start+int(.8*sr)],sr)
x*=np.linspace(1,0,len(x))**1.4
write('settle.wav',x,sr)
report.append(dict(file='settle.wav',sourceStart=2.6,duration=.8,peakDb=round(20*np.log10(max(abs(x))),2),rmsDb=round(20*np.log10(np.sqrt(np.mean(x*x))),2)))
(ROOT/'docs/audio-analysis.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
