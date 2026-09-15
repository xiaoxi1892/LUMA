"""Two distinct recorded materials; reproducible trims, filtering and peak limits."""
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt
root=Path(__file__).resolve().parents[1]
def read(name):
 x,sr=sf.read(root/'public/audio/raw'/name)
 return (x.mean(axis=1) if x.ndim>1 else x),sr

def output(x,sr,name,low,high,peak=.24):
 x=x-x.mean();x=sosfiltfilt(butter(2,[low,high],btype='band',fs=sr,output='sos'),x)
 x=np.tanh(x*1.4);x*=peak/max(.001,np.abs(x).max())
 fade=min(int(sr*.012),len(x)//4);x[:fade]*=np.linspace(0,1,fade);x[-fade:]*=np.linspace(1,0,fade)
 sf.write(root/'public/audio'/name,x,sr,subtype='PCM_16')
 print(name,'duration',round(len(x)/sr,3),'peak dBFS',round(20*np.log10(np.abs(x).max()),2))
x,sr=read('suction-1261.wav')
for i,t in enumerate([.12,1.61,3.32]):output(x[int(t*sr):int((t+.46)*sr)],sr,f'cell-{i+1}.wav',90,1800)
x,sr=read('glass-ball-2240.wav')
for i,t in enumerate([.04,1.32,2.37]):output(x[int(t*sr):int((t+.40)*sr)],sr,f'bead-{i+1}.wav',400,3900,.20)
output(x[int(3.4*sr):int(5.5*sr)],sr,'bead-roll.wav',240,2300,.14)
