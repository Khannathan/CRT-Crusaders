import json,glob,os,sys,shutil
from PIL import Image
import numpy as np
from scipy import ndimage
# Art intake for Aaron's ChatGPT exports (exact nearest-neighbour upscales).
# Run from this folder:  python3 cut.py <unzipped art folder>/ && python3 finalize.py
# then copy stage/* into src/assets/. Needs Pillow, numpy and scipy.
# Downscales each file to its native pixel grid, cuts the icon sheets (4x4 grids, or
# free layouts by connected parts in reading order, named from Manifest.json), and
# makes square enemy busts (plain and Blasphemy pose) from the full-body figures.
R=(sys.argv[1] if len(sys.argv)>1 else '../redo/'); O='stage/'
shutil.rmtree(O,ignore_errors=True)
for d in ['ui','portraits','full-body','enemies','enemy-full']: os.makedirs(O+d)
man=json.load(open(R+'Manifest.json'))['sheet_keys_row_major']

def down(path,k):
    im=Image.open(path).convert('RGBA')
    return im.resize((im.width//k,im.height//k),Image.NEAREST)
def save(im,path,opaque=False):
    if opaque: im=im.convert('RGB')
    # palette PNG when few colours: small files, exact colours
    cols=im.getcolors(256)
    if cols is not None:
        im=im.quantize(colors=256,method=Image.Quantize.FASTOCTREE if im.mode=='RGBA' else Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE) if im.mode=='RGB' else im
    im.save(O+path,optimize=True)
def trim(im,pad=1):
    a=np.array(im)[...,3]; ys,xs=np.nonzero(a>0)
    return im.crop((max(0,xs.min()-pad),max(0,ys.min()-pad),min(im.width,xs.max()+1+pad),min(im.height,ys.max()+1+pad)))
def square(im):
    s=max(im.size); out=Image.new('RGBA',(s,s)); out.alpha_composite(im,((s-im.width)//2,(s-im.height)//2)); return out
sizes={}
# Photos/scenes
for f in glob.glob(R+'Sister_Busts/*.png'):
    save(down(f,8),'portraits/'+os.path.basename(f)[9:],True)
for f in glob.glob(R+'Limited_Saints/*.png'):
    save(down(f,8),'full-body/'+os.path.basename(f))
for d,k in [('Crypt_Backgrounds',4),('Screen_Backgrounds',4),('Order_Banners',8),('Event_Scenes',8),('Campaign_Chapters',8),('Hound_Busts',8)]:
    for f in glob.glob(R+d+'/*.png'): save(down(f,8 if k==8 else 4),'ui/'+os.path.basename(f),True)
lg=trim(down(R+'Icon_UI_Sheets/logo.png',8),0); save(lg,'ui/logo.png'); sizes['logo']=lg.size
# Enemies: full figure + square bust for portraits
def bust(crop,side,n):
    bg=Image.new('RGBA',crop.size,(27,21,30,255))
    g=np.linspace(0,1,side); vv=np.sqrt((g[None,:]-.5)**2+(g[:,None]-.45)**2)
    arr=np.array(bg).astype(float)
    # a vignette in the palette's ink colours, in 4 flat bands so it reads as pixel art
    bands=np.round(np.clip(vv*1.6,0,1)*3)/3; arr[...,:3]=np.array([58,40,54])*(1-bands)[...,None]+np.array([20,15,22])*bands[...,None]
    bg=Image.fromarray(arr.astype('uint8')); bg.alpha_composite(crop)
    save(bg,'enemies/'+n+'.png',True)
for f in glob.glob(R+'Enemies/*.png'):
    n=os.path.basename(f)[6:-4]; im=down(f,8); save(im,'enemy-full/'+n+'.png')
    if n.endswith('-blasphemy'): continue
    pose=R+'Enemies/enemy-'+n+'-blasphemy.png'
    alt=down(pose,8) if os.path.exists(pose) else None
    a=np.array(im)[...,3]; ys,xs=np.nonzero(a>0); top,bot,l,r=ys.min(),ys.max(),xs.min(),xs.max()
    bh=bot-top+1
    side=int(np.clip(bh*0.5,64,96)) if bh>90 else bh+12
    head=np.nonzero(a[top:top+max(8,side//3)].any(0))[0]; cx=(head.min()+head.max())//2 if bh>90 else (l+r)//2
    y0=max(0,top-6) if bh>90 else max(0,(top+bot)//2-side//2)
    x0=int(np.clip(cx-side//2,0,128-side))
    for src,nm in [(im,n)]+([(alt,n+'-blasphemy')] if alt is not None else []):
        bust(src.crop((x0,y0,x0+side,y0+side)),side,nm)
# Grid sheets
FREE={'sheet-ui-frames-1.png','sheet-ui-buttons.png','sheet-ui-bars-and-strips.png','sheet-ui-candles.png','sheet-litany-and-wrath-ui.png'}
for sheet,cells in man.items():
    if sheet in FREE: continue
    full=Image.open(R+'Icon_UI_Sheets/'+sheet).convert('RGBA'); k=8 if full.getpixel((0,0)) is None else None
    a=np.array(full).astype(int)
    k=8 if not np.any(np.abs(np.repeat(np.repeat(a[::8,::8],8,0),8,1)-a).max(-1)>8) else 4
    im=full.resize((1024//k,1024//k),Image.NEAREST); c=im.width//4
    for e in cells:
        i=e['cell']-1; cell=im.crop(((i%4)*c,(i//4)*c,(i%4+1)*c,(i//4+1)*c))
        if cell.getbbox() is None: print('EMPTY',sheet,e['name']); continue
        cell=square(trim(cell))
        save(cell,'ui/'+e['name']); sizes[e['name']]=cell.size
# Free-layout sheets: connected parts in reading order
DIL={"sheet-litany-and-wrath-ui.png":2,"sheet-ui-buttons.png":0}
def parts(sheet,n,group=None):
    im=down(R+'Icon_UI_Sheets/'+sheet,4); a=np.array(im)[...,3]>0
    d=DIL.get(sheet,1)
    lab,num=ndimage.label(ndimage.binary_dilation(a,iterations=d) if d else a)
    objs=ndimage.find_objects(lab)
    boxes=[(s[0].start,s[0].stop,s[1].start,s[1].stop) for s in objs if (s[0].stop-s[0].start)*(s[1].stop-s[1].start)>30]
    boxes.sort(key=lambda b:b[0])
    rows=[]
    for b in boxes:
        for r in rows:
            if b[0]<r[-1][1]-2 and b[1]>r[0][0]+2 and abs((b[0]+b[1])/2-(r[0][0]+r[0][1])/2)<max(b[1]-b[0],r[0][1]-r[0][0])/2:
                r.append(b); break
        else: rows.append([b])
    out=[]
    for r in rows: out+=sorted(r,key=lambda b:b[2])
    res=[]
    for b in out:
        y0,y1,x0,x1=b; crop=im.crop((x0,y0,x1,y1)); m=(lab[y0:y1,x0:x1]==lab[(y0+y1)//2, (x0+x1)//2]) if False else None
        res.append(trim(crop,0))
    print(sheet,len(res),'want',n,[r.size for r in res])
    return res,out
for sheet in FREE:
    names=[e['name'] for e in man[sheet]]
    res,boxes=parts(sheet,len(names))
    if sheet=='sheet-ui-candles.png':
        frames=res[:6]; fw=max(f.width for f in frames); fh=max(f.height for f in frames)
        strip=Image.new('RGBA',(fw*6,fh))
        for i,f in enumerate(frames): strip.alpha_composite(f,(i*fw+(fw-f.width)//2,fh-f.height))
        res=[strip]+res[6:]
    if len(res)!=len(names): print('MISMATCH',sheet); continue
    for nme,r in zip(names,res):
        r=r.resize((r.width*2,r.height*2),Image.NEAREST); save(r,'ui/'+nme); sizes[nme]=r.size
json.dump(sizes,open('sizes.json','w'),indent=0)
