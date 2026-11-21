from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

# Each hexadecimal row represents five horizontal pixels.
rows = {
    "A":"0e11111f111111", "B":"1e11111e11111e", "C":"0e11101010110e",
    "D":"1e11111111111e", "E":"1f10101e10101f", "F":"1f10101e101010",
    "G":"0e11101711110e", "H":"1111111f111111", "I":"0e04040404040e",
    "J":"0702020212120c", "K":"11121418141211", "L":"1010101010101f",
    "M":"111b1515111111", "N":"11191915131311", "O":"0e11111111110e",
    "P":"1e11111e101010", "Q":"0e11111115120d", "R":"1e11111e141211",
    "S":"0f10100e01011e", "T":"1f040404040404", "U":"1111111111110e",
    "V":"11111111110a04", "W":"11111115151b11", "X":"11110a040a1111",
    "Y":"11110a04040404", "Z":"1f01020408101f",
    "a":"00000e010f110f", "b":"10101e1111111e", "c":"00000f1010100f",
    "d":"01010f1111110f", "e":"00000e111f100f", "f":"0609081e080808",
    "g":"00000f11110f010e00", "h":"10101e11111111", "i":"04000c0404040e",
    "j":"02000602020202120c", "k":"101011121c1211", "l":"0c04040404040e",
    "m":"00001a15151515", "n":"00001e11111111", "o":"00000e1111110e",
    "p":"00001e1111111e1010", "q":"00000f1111110f0101", "r":"00001619101010",
    "s":"00000f100e011e", "t":"08081e08080906", "u":"0000111111110f",
    "v":"00001111110a04", "w":"0000111115150a", "x":"0000110a040a11",
    "y":"00001111110f010e00", "z":"00001f0204081f",
    "0":"0e11131519110e", "1":"040c040404040e", "2":"0e11010204081f",
    "3":"1e01010601111e", "4":"02060a121f0202", "5":"1f10101e01111e",
    "6":"0608101e11110e", "7":"1f010204080808", "8":"0e11110e11110e",
    "9":"0e11110f01020c", " ":"00000000000000",
    "!":"04040404040004", '"':"0a0a0a00000000", "#":"0a0a1f0a1f0a0a",
    "$":"040f140e051e04", "%":"18190204081303", "&":"0c12140c15120d",
    "'":"04040400000000", "(":"02040808080402", ")":"08040202020408",
    "*":"00150e1f0e1500", "+":"0004041f040400", ",":"000000000006040800",
    "-":"0000001f000000", ".":"00000000000004", "/":"01010204081010",
    ":":"00040000040000", ";":"000400000600040800", "<":"01020408040201",
    "=":"00001f001f0000", ">":"10080402040810", "?":"0e110102040004",
    "@":"0e11171517100e", "[":"0e08080808080e", "\\":"10100804020101",
    "]":"0e02020202020e", "^":"040a1100000000", "_":"000000000000001f00",
    "`":"08040000000000", "{":"06040408040406", "|":"04040404040404",
    "}":"0c04040204040c", "~":"000000090a1200",
    "×":"0000110a040a11", "·":"00000004000000", "•":"0000040e040000",
    "–":"0000001f000000", "—":"0000001f000000", "’":"04040800000000",
    "‘":"02040400000000", "“":"050a0a00000000", "”":"0a0a1400000000",
    "…":"00000000000015", "◆":"00040e1f0e0400", "†":"04041f04040404",
    "←":"0004081f080400", "→":"0004021f020400", "↑":"040e1504040400",
    "↓":"04040404150e04", "★":"04041f0e0a1100", "♡":"001b15110a0400"
}

root = Path(__file__).resolve().parent
unit = 100
names = {ord(char): f"uni{ord(char):04X}" for char in rows}
glyphs = {".notdef": TTGlyphPen(None).glyph()}
metrics = {".notdef": (600, 0)}

for char, pattern in rows.items():
    name = names[ord(char)]
    pen = TTGlyphPen(None)
    # Merge adjacent pixels along a row into one clockwise contour.
    for row in range(len(pattern) // 2):
        bits = int(pattern[row * 2:row * 2 + 2], 16)
        binary = f"{bits:05b}"
        start = 0
        while start < 5:
            if binary[start] == "0":
                start += 1
                continue
            end = start + 1
            while end < 5 and binary[end] == "1":
                end += 1
            left, right = (start * unit + 50, end * unit + 50)
            low = (6 - row) * unit
            pen.moveTo((left, low))
            pen.lineTo((left, low + unit))
            pen.lineTo((right, low + unit))
            pen.lineTo((right, low))
            pen.closePath()
            start = end
    built = pen.glyph()
    if built.numberOfContours:
        built.recalcBounds(None)
    else:
        built.xMin = 0
    glyphs[name] = built
    metrics[name] = (600, built.xMin)

builder = FontBuilder(1000, isTTF=True)
builder.setupGlyphOrder(list(glyphs))
builder.setupCharacterMap(names)
builder.setupGlyf(glyphs)
builder.setupHorizontalMetrics(metrics)
builder.setupHorizontalHeader(ascent=800, descent=-200)
builder.setupNameTable({
    "familyName": "Vigil Pixel", "styleName": "Regular",
    "uniqueFontIdentifier": "CRT Crusaders:Vigil Pixel Regular:1.0",
    "fullName": "Vigil Pixel Regular", "psName": "VigilPixel-Regular",
    "version": "Version 1.000"
})
builder.setupOS2(version=4, sTypoAscender=800, sTypoDescender=-200,
                 usWinAscent=800, usWinDescent=200, fsSelection=0xC0,
                 sCapHeight=700, sxHeight=500)
builder.setupPost(isFixedPitch=1)
# CRT Crusaders: writes the TTF next to this script and the WOFF2 the game loads.
ttf = root / "VigilPixel-Regular.ttf"
builder.save(ttf)
with TTFont(ttf) as font:
    font.flavor = "woff2"
    font.save(root.parent / "src/assets/fonts/VigilPixel.woff2")
