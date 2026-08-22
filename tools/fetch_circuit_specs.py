"""Official circuit specifications from Wikipedia infoboxes (CC BY-SA)."""
import json, re, urllib.request, urllib.parse, time

PAGES = {
 'australian':'Albert Park Circuit','chinese':'Shanghai International Circuit',
 'japanese':'Suzuka International Racing Course','miami':'Miami International Autodrome',
 'canadian':'Circuit Gilles Villeneuve','monaco':'Circuit de Monaco',
 'barcelona':'Circuit de Barcelona-Catalunya','austrian':'Red Bull Ring',
 'british':'Silverstone Circuit','belgian':'Circuit de Spa-Francorchamps',
 'hungarian':'Hungaroring','dutch':'Circuit Zandvoort','italian':'Monza Circuit',
 'spanish':'Madring','azerbaijan':'Baku City Circuit','bahrain':'Sepang International Circuit',
 'singapore':'Marina Bay Street Circuit','united-states':'Circuit of the Americas',
 'mexico-city':'Autódromo Hermanos Rodríguez','sao-paulo':'Interlagos Circuit',
 'las-vegas':'Las Vegas Strip Circuit','qatar':'Lusail International Circuit',
 'abu-dhabi':'Yas Marina Circuit',
}

def wikitext(title):
    u=('https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&redirects=1&page='
       +urllib.parse.quote(title))
    r=urllib.request.Request(u,headers={'User-Agent':'GridPredBuild/1.0'})
    return json.load(urllib.request.urlopen(r,timeout=45))['parse']['wikitext']['*']

def num(s):
    m=re.search(r'([\d]+(?:\.[\d]+)?)',s.replace(',',''))
    return float(m.group(1)) if m else None

out={}
for cid,title in PAGES.items():
    try:
        w=wikitext(title)
        # the F1 layout block usually carries length / turns
        length=None; turns=None
        for pat in [r'\|\s*length_km\s*=\s*([^\n|]+)', r'\|\s*length\s*=\s*([^\n|]+)']:
            m=re.search(pat,w)
            if m: length=num(m.group(1)); break
        m=re.search(r'\|\s*turns\s*=\s*([^\n|]+)',w)
        if m: turns=num(m.group(1))
        # grand prix record / current configuration length in km
        if length and length>100: length=length/1000.0
        out[cid]={'wikiTitle':title,'trackLength':length,'turnsWiki':int(turns) if turns else None}
        print(f'{cid:<15} {title[:38]:<38} len={length} turns={turns}')
    except Exception as e:
        out[cid]={'wikiTitle':title,'trackLength':None,'turnsWiki':None}
        print(f'{cid:<15} FAIL {type(e).__name__}')
    time.sleep(0.2)
json.dump(out,open('out/specs.json','w'),indent=1)
