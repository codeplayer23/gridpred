"""
Season extraction: drivers, teams, results, standings.

Capability ratings are DERIVED ARITHMETICALLY from real classifications (grid
slots, finishing positions, stint lengths). Nothing is guessed. Where a season
offers no basis for a rating — no wet running yet, no street-circuit rounds —
the value is null and the UI omits it rather than showing an invented number.
"""
import fastf1, warnings, json, os, sys, math
import numpy as np, pandas as pd
warnings.filterwarnings('ignore')
import logging
for n in ['fastf1','fastf1.core','fastf1.req','fastf1._api','fastf1.api','fastf1.events']:
    logging.getLogger(n).setLevel(logging.ERROR)
fastf1.Cache.enable_cache('f1cache')
OUT='out'; os.makedirs(OUT,exist_ok=True); SEASON=2026
def log(*a): print(*a,file=sys.stderr,flush=True)

def sslug(s):
    import unicodedata,re
    s=unicodedata.normalize('NFD',str(s))
    s=''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')

POINTS_POS={1:25,2:18,3:15,4:12,5:10,6:8,7:6,8:4,9:2,10:1}

# FastF1 leaves CountryCode empty for the 2026 sessions, so nationality comes
# from the published entry list for the season.
NATIONALITY={
 'Kimi Antonelli':('Italy','IT'),'Lewis Hamilton':('United Kingdom','GB'),
 'George Russell':('United Kingdom','GB'),'Charles Leclerc':('Monaco','MC'),
 'Lando Norris':('United Kingdom','GB'),'Max Verstappen':('Netherlands','NL'),
 'Oscar Piastri':('Australia','AU'),'Isack Hadjar':('France','FR'),
 'Liam Lawson':('New Zealand','NZ'),'Pierre Gasly':('France','FR'),
 'Arvid Lindblad':('United Kingdom','GB'),'Franco Colapinto':('Argentina','AR'),
 'Oliver Bearman':('United Kingdom','GB'),'Gabriel Bortoleto':('Brazil','BR'),
 'Carlos Sainz':('Spain','ES'),'Alexander Albon':('Thailand','TH'),
 'Esteban Ocon':('France','FR'),'Nico Hulkenberg':('Germany','DE'),
 'Fernando Alonso':('Spain','ES'),'Lance Stroll':('Canada','CA'),
 'Valtteri Bottas':('Finland','FI'),'Sergio Perez':('Mexico','MX'),
 'Yuki Tsunoda':('Japan','JP'),
}
def flag_of(cc):
    return ''.join(chr(0x1F1E6+ord(c)-ord('A')) for c in cc) if cc else None
def nat_of(name):
    import unicodedata as u
    k=''.join(c for c in u.normalize('NFD',name) if u.category(c)!='Mn').replace(' Jr.','')
    return NATIONALITY.get(k,(None,None))

sched=fastf1.get_event_schedule(SEASON,include_testing=False)
sched=sched[sched['RoundNumber']>0].sort_values('RoundNumber')
now=pd.Timestamp.utcnow().tz_localize(None)
done=[e for e in sched.itertuples() if pd.Timestamp(e.EventDate)<now]
log(f'completed rounds: {len(done)}')

drivers={}   # number -> record
rounds=[]

for ev in done:
    rnd=int(ev.RoundNumber)
    cid=sslug(str(ev.EventName).replace(' Grand Prix',''))
    try:
        s=fastf1.get_session(SEASON,rnd,'R')
        s.load(telemetry=False,laps=True,weather=True,messages=False)
    except Exception as e:
        log(f'R{rnd} load fail: {e}'); continue

    res=s.results
    # weather for the session (real)
    wet=None
    try:
        w=s.weather_data
        wet=bool(w['Rainfall'].any()) if w is not None and len(w) else None
        air=round(float(w['AirTemp'].mean()),1) if w is not None and len(w) else None
        track=round(float(w['TrackTemp'].mean()),1) if w is not None and len(w) else None
    except Exception:
        air=track=None

    # pit stops + stints per driver (real, from lap data)
    stops={}; compounds={}
    try:
        laps=s.laps
        for drv,grp in laps.groupby('Driver'):
            stints=grp.groupby('Stint')['LapNumber'].count()
            stops[drv]=max(0,len(stints)-1)
            compounds[drv]=[c for c in grp.groupby('Stint')['Compound'].first().tolist() if isinstance(c,str)]
    except Exception:
        pass

    # Sprint weekends carry their own points; without them the championship
    # table silently disagrees with the official standings.
    sprint_pts={}; sprint_rows=[]
    if 'sprint' in str(ev.EventFormat):
        try:
            sp=fastf1.get_session(SEASON,rnd,'S')
            sp.load(telemetry=False,laps=False,weather=False,messages=False)
            for sr in sp.results.itertuples():
                n=str(sr.DriverNumber)
                p=0.0 if pd.isna(sr.Points) else float(sr.Points)
                sprint_pts[n]=p
                sprint_rows.append({'driverNumber':n,'abbreviation':str(sr.Abbreviation),
                                    'position':None if pd.isna(sr.Position) else int(sr.Position),
                                    'points':p})
            log(f'   sprint R{rnd}: {len(sprint_rows)} rows, {sum(sprint_pts.values()):.0f} pts')
        except Exception as e:
            log(f'   sprint R{rnd} unavailable: {e}')

    fl_driver=None
    try:
        fl=s.laps.pick_fastest()
        fl_driver=str(fl['Driver'])
    except Exception:
        pass

    rows=[]
    for r in res.itertuples():
        num=str(r.DriverNumber); abbr=str(r.Abbreviation)
        pos=None if pd.isna(r.Position) else int(r.Position)
        grid=None if pd.isna(r.GridPosition) else int(r.GridPosition)
        pts=0.0 if pd.isna(r.Points) else float(r.Points)
        status=str(r.Status)
        did=sslug(str(r.FullName))
        rec=drivers.setdefault(num,{
            'id':did,'number':int(num),'abbreviation':abbr,
            'firstName':str(r.FirstName),'lastName':str(r.LastName),'fullName':str(r.FullName),
            'teamName':str(r.TeamName),'teamColor':'#'+str(r.TeamColor) if r.TeamColor else '#888888',
            'nationality':nat_of(str(r.FullName))[0],
            'countryCode':(str(r.CountryCode) or None) or nat_of(str(r.FullName))[1],
            'flag':flag_of(nat_of(str(r.FullName))[1]),
            'headshotUrl':(str(r.HeadshotUrl) if isinstance(r.HeadshotUrl,str) and r.HeadshotUrl else None),
            'points':0.0,'wins':0,'podiums':0,'poles':0,'fastestLaps':0,'dnfs':0,'starts':0,
            'positions':[],'grids':[],'form':[],
        })
        rec['teamName']=str(r.TeamName)
        rec['teamColor']='#'+str(r.TeamColor) if r.TeamColor else rec['teamColor']
        spts=sprint_pts.get(num,0.0)
        rec['points']+=pts+spts; rec['sprintPoints']=rec.get('sprintPoints',0.0)+spts
        rec['starts']+=1
        if grid==1: rec['poles']+=1
        finished = status=='Finished' or status.startswith('+')
        if finished and pos:
            rec['positions'].append(pos)
            if pos==1: rec['wins']+=1
            if pos<=3: rec['podiums']+=1
        else:
            rec['dnfs']+=1
        if grid: rec['grids'].append(grid)
        if fl_driver and abbr==fl_driver: rec['fastestLaps']+=1

        rec['form'].append({
            'round':rnd,'circuitId':cid,'event':str(ev.EventName),
            'position':pos,'grid':grid,'points':pts,'status':status,
            'finished':bool(finished),
            'pitStops':stops.get(abbr),
            'compounds':compounds.get(abbr,[]),
            'fastestLap':bool(fl_driver and abbr==fl_driver),
            'wet':wet,'airTemp':air,'trackTemp':track,
        })
        rows.append({'driverId':did,'teamId':sslug(str(r.TeamName)),'position':pos,'grid':grid,
                     'points':pts,'sprintPoints':spts,'status':status,'time':(str(r.Time) if not pd.isna(r.Time) else None),
                     'fastestLap':bool(fl_driver and abbr==fl_driver)})

    rounds.append({'round':rnd,'circuitId':cid,'event':str(ev.EventName),
                   'isSprint':'sprint' in str(ev.EventFormat),'sprint':sprint_rows,
                   'date':pd.Timestamp(ev.EventDate).date().isoformat(),
                   'wet':wet,'airTemp':air,'trackTemp':track,
                   'polePosition':next((x['driverId'] for x in rows if x['grid']==1),None),
                   'winner':next((x['driverId'] for x in rows if x['position']==1),None),
                   'results':rows})
    log(f'R{rnd:>2} {ev.EventName[:28]:<28} rows={len(rows)} wet={wet}')

# ── derived capability ratings ────────────────────────────────────────────
def scale(v, lo, hi):
    """Map a value into 0-100 where lo->100 and hi->0 (lower position = better)."""
    if v is None: return None
    return round(max(0.0,min(100.0,(hi-v)/(hi-lo)*100)),1)

allpos=[p for d in drivers.values() for p in d['positions']]
for d in drivers.values():
    pos=d['positions']; grids=d['grids']
    d['avgFinish']=round(float(np.mean(pos)),2) if pos else None
    d['avgGrid']=round(float(np.mean(grids)),2) if grids else None
    d['bestFinish']=min(pos) if pos else None
    d['finishRate']=round(100*(d['starts']-d['dnfs'])/d['starts']) if d['starts'] else None
    gained=[f['grid']-f['position'] for f in d['form'] if f['finished'] and f['grid'] and f['position']]
    d['avgPositionsGained']=round(float(np.mean(gained)),2) if gained else None

    wetf=[f for f in d['form'] if f['wet'] and f['finished'] and f['position']]
    street=[f for f in d['form'] if f['circuitId'] in {'monaco','azerbaijan','singapore','las-vegas','miami'} and f['finished'] and f['position']]
    fast=[f for f in d['form'] if f['circuitId'] in {'italian','belgian','british','azerbaijan','las-vegas'} and f['finished'] and f['position']]
    slow=[f for f in d['form'] if f['circuitId'] in {'monaco','hungarian','singapore','dutch'} and f['finished'] and f['position']]

    d['ratings']={
        'qualifying': scale(d['avgGrid'],1,20),
        'racePace': scale(d['avgFinish'],1,20),
        'consistency': (round(max(0.0,min(100.0,100-float(np.std(pos))*7)),1) if len(pos)>=3 else None),
        'overtaking': (round(max(0.0,min(100.0,50+d['avgPositionsGained']*10)),1) if d['avgPositionsGained'] is not None else None),
        'reliability': float(d['finishRate']) if d['finishRate'] is not None else None,
        'wetWeather': (scale(float(np.mean([f['position'] for f in wetf])),1,20) if wetf else None),
        'streetCircuits': (scale(float(np.mean([f['position'] for f in street])),1,20) if street else None),
        'highSpeedCircuits': (scale(float(np.mean([f['position'] for f in fast])),1,20) if fast else None),
        'lowSpeedCircuits': (scale(float(np.mean([f['position'] for f in slow])),1,20) if slow else None),
        'tyreManagement': None,
    }
    d['ratingSamples']={
        'qualifying':len(grids),'racePace':len(pos),'consistency':len(pos),
        'overtaking':len(gained),'reliability':d['starts'],
        'wetWeather':len(wetf),'streetCircuits':len(street),
        'highSpeedCircuits':len(fast),'lowSpeedCircuits':len(slow),
        'tyreManagement':len([f for f in d['form'] if f['compounds']]),
    }
    stints=[len(f['compounds']) for f in d['form'] if f['compounds']]
    if stints:
        d['ratings']['tyreManagement']=round(max(0.0,min(100.0,110-float(np.mean(stints))*22)),1)
    d.pop('positions'); d.pop('grids')

# standings
ordered=sorted(drivers.values(),key=lambda d:(-d['points'],d['avgFinish'] if d['avgFinish'] else 99))
for i,d in enumerate(ordered): d['position']=i+1
for d in ordered: d['points']=round(d['points'],1) if d['points']%1 else int(d['points'])

# teams
teams={}
for d in ordered:
    tid=sslug(d['teamName'])
    t=teams.setdefault(tid,{'id':tid,'name':d['teamName'],'abbreviation':d['teamName'][:3].upper(),
                            'color':d['teamColor'],'drivers':[],'points':0,'wins':0,'podiums':0,
                            'poles':0,'fastestLaps':0,'dnfs':0,'grids':[],'finishes':[]})
    t['drivers'].append(d['id'])
    for k in ('points','wins','podiums','poles','fastestLaps','dnfs'): t[k]+=d[k]
    if d['avgGrid']: t['grids'].append(d['avgGrid'])
    if d['avgFinish']: t['finishes'].append(d['avgFinish'])
for t in teams.values():
    t['avgGrid']=round(float(np.mean(t['grids'])),2) if t['grids'] else None
    t['avgFinish']=round(float(np.mean(t['finishes'])),2) if t['finishes'] else None
    t['qualifyingPace']=scale(t['avgGrid'],1,20); t['racePace']=scale(t['avgFinish'],1,20)
    t.pop('grids'); t.pop('finishes')
tlist=sorted(teams.values(),key=lambda t:(-t['points'],-t['wins']))
for i,t in enumerate(tlist): t['position']=i+1; t['points']=round(t['points'],1) if t['points']%1 else int(t['points'])

json.dump(ordered,open(f'{OUT}/drivers.json','w'),indent=1)
json.dump(tlist,open(f'{OUT}/teams.json','w'),indent=1)
json.dump(rounds,open(f'{OUT}/results.json','w'),indent=1)
json.dump({'drivers':[{'driverId':d['id'],'position':d['position'],'points':d['points'],
                       'wins':d['wins'],'teamId':sslug(d['teamName'])} for d in ordered],
           'constructors':[{'teamId':t['id'],'position':t['position'],'points':t['points'],'wins':t['wins']} for t in tlist]},
          open(f'{OUT}/standings.json','w'),indent=1)
json.dump({'season':SEASON,'generatedAt':pd.Timestamp.utcnow().isoformat(),
           'source':'FastF1 %s'%fastf1.__version__,'roundsCompleted':len(rounds),
           'totalRounds':int(sched['RoundNumber'].max()),
           'note':'DRS was abolished by the 2026 technical regulations; the DRS telemetry channel reads zero all season, so no DRS zones are rendered.'},
          open(f'{OUT}/meta.json','w'),indent=1)
log(f'\ndrivers={len(ordered)} teams={len(tlist)} rounds={len(rounds)}')
for d in ordered[:6]: log(f"  {d['position']:>2} {d['fullName'][:22]:<22} #{d['number']:<3} {d['points']:>5} {d['teamName'][:18]}")
