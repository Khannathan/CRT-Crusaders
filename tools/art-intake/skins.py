import sys,json
from PIL import Image, ImageDraw
import numpy as np
S='stage/ui/'
def medoid_band(arr, axis):
    # arr: band (rows x cols x 4) ; pick the column (axis=1) closest to all others
    cols = arr if axis==1 else arr.transpose(1,0,2)
    flat = cols.transpose(1,0,2).reshape(cols.shape[1],-1).astype(float)
    med = np.median(flat,0)
    i = np.argmin(((flat-med)**2).sum(1))
    return i
def clean(im, c, sides=(1,1,1,1)):
    """Replace the stretchable middle of each edge band with its most typical slice, so
    ornaments in the middle of an edge don't smear when the 9-slice stretches."""
    a=np.array(im.convert('RGBA')); h,w=a.shape[:2]; o=a.copy()
    if w>2*c:
        for band in (slice(0,c),slice(h-c,h)):
            mid=a[band,c:w-c]; i=medoid_band(mid,1); o[band,c:w-c]=mid[:,i:i+1]
    if h>2*c:
        for band in (slice(0,c),slice(w-c,w)):
            mid=a[c:h-c,band]; i=medoid_band(mid.transpose(1,0,2),1); o[c:h-c,band]=mid[i:i+1,:]
    return Image.fromarray(o)
def nine(im,c,W,H):
    w,h=im.size; c=int(max(1,min(c,W/2,H/2,w/2,h/2)))
    out=Image.new('RGBA',(W,H))
    xs=[(0,c,0,c),(c,w-c,c,W-c),(w-c,w,W-c,W)]; ys=[(0,c,0,c),(c,h-c,c,H-c),(h-c,h,H-c,H)]
    for sx0,sx1,dx0,dx1 in xs:
        for sy0,sy1,dy0,dy1 in ys:
            if sx1>sx0 and sy1>sy0 and dx1>dx0 and dy1>dy0:
                out.alpha_composite(im.crop((sx0,sy0,sx1,sy1)).resize((dx1-dx0,dy1-dy0),Image.NEAREST),(dx0,dy0))
    return out
def fill_centre(im,c):
    a=np.array(im.convert('RGBA')); h,w=a.shape[:2]
    mid=a[c:h-c,c:w-c].reshape(-1,4); med=np.median(mid,0).astype('uint8')
    a[c:h-c,c:w-c]=med; return Image.fromarray(a)
