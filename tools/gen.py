#!/usr/bin/env python3
"""Legacy League Golf demo — sample data generator.

Writes two files:
  data/league.json  what the CMS would own: cities, players, schedule, rules
  data/feed.json    what the scoring provider would send, shaped like a
                    Golf Genius API v2 payload (event / rounds / tee_sheet / scores).
                    Field names are modelled on Golf Genius' public API and must be
                    confirmed against the real contract once Legacy grants access.

Everything is FICTIONAL: player names are generated, cities carry their real
franchise heritage only. Deterministic (seeded) so the demo is reproducible.
"""
import json, random, pathlib, datetime as dt

random.seed(20270124)
ROOT = pathlib.Path(__file__).resolve().parent.parent

# ------------------------------------------------------------------ course
# El Camaleón, Mayakoba — PGA TOUR tournament setup (par 71, 7,034 yd)
HOLES = [(1,4,438),(2,4,428),(3,4,389),(4,3,116),(5,5,554),(6,4,416),(7,5,571),(8,3,151),(9,4,462),
         (10,3,200),(11,4,360),(12,4,451),(13,5,532),(14,4,452),(15,3,155),(16,4,515),(17,4,386),(18,4,458)]
PAR = [p for _, p, _ in HOLES]

# ------------------------------------------------------------------ cities
CITIES = [
 dict(id="chi", name="Chicago",       short="CHI", color="#c83803", color2="#0b162a", teams=["Bears","Bulls","Cubs","White Sox","Blackhawks"]),
 dict(id="bos", name="Boston",        short="BOS", color="#007a33", color2="#bd3039", teams=["Celtics","Red Sox","Patriots","Bruins"]),
 dict(id="nyc", name="New York",      short="NYC", color="#f58426", color2="#003087", teams=["Yankees","Knicks","Giants","Jets","Mets","Rangers"]),
 dict(id="lax", name="Los Angeles",   short="LA",  color="#fdb927", color2="#552583", teams=["Lakers","Dodgers","Rams","Kings"]),
 dict(id="dal", name="Dallas",        short="DAL", color="#869397", color2="#002244", teams=["Cowboys","Mavericks","Stars","Rangers"]),
 dict(id="phi", name="Philadelphia",  short="PHI", color="#004c54", color2="#a5acaf", teams=["Eagles","76ers","Phillies","Flyers"]),
 dict(id="det", name="Detroit",       short="DET", color="#0076b6", color2="#c8102e", teams=["Lions","Pistons","Tigers","Red Wings"]),
 dict(id="sfo", name="San Francisco", short="SF",  color="#aa0000", color2="#b3995d", teams=["49ers","Giants","Warriors"]),
 dict(id="mia", name="Miami",         short="MIA", color="#008e97", color2="#fc4c02", teams=["Dolphins","Heat","Marlins"]),
]
SPORT_OF = {"Bears":"NFL","Bulls":"NBA","Cubs":"MLB","White Sox":"MLB","Blackhawks":"NHL","Celtics":"NBA","Red Sox":"MLB",
 "Patriots":"NFL","Bruins":"NHL","Yankees":"MLB","Knicks":"NBA","Giants":"NFL","Jets":"NFL","Mets":"MLB","Rangers":"NHL",
 "Lakers":"NBA","Dodgers":"MLB","Rams":"NFL","Kings":"NHL","Cowboys":"NFL","Mavericks":"NBA","Stars":"NHL","Eagles":"NFL",
 "76ers":"NBA","Phillies":"MLB","Flyers":"NHL","Lions":"NFL","Pistons":"NBA","Tigers":"MLB","Red Wings":"NHL","49ers":"NFL",
 "Warriors":"NBA","Dolphins":"NFL","Heat":"NBA","Marlins":"MLB"}
# Dallas Rangers are MLB, New York Rangers NHL
POS = {"NFL":["Quarterback","Wide receiver","Linebacker","Running back","Safety","Tight end","Offensive tackle"],
       "NBA":["Point guard","Shooting guard","Forward","Center"],
       "MLB":["Pitcher","Shortstop","Outfielder","Catcher","First baseman"],
       "NHL":["Centre","Winger","Defenceman","Goaltender"]}

FIRST = ["Marcus","Devin","Tyrell","Jordan","Reggie","Calvin","Darnell","Shane","Luis","Andre","Trent","Omar","Brett","Kurt","Dwayne",
         "Isaiah","Grant","Rashad","Cole","Theo","Victor","Emmett","Roy","Jamal","Nate","Ellis","Hank","Lamar","Pat","Wes",
         "Maya","Simone","Jada","Renee","Tasha","Nicole","Dana","Priya","Lauren","Kendra"]
LAST = ["Whitfield","Okafor","Brennan","Castellano","Hargrove","Delgado","Pruitt","Vance","Kowalski","Ashby","Mercer","Lindqvist",
        "Fontaine","Rivera","Thibodeaux","Granger","Holloway","Nakamura","O'Donnell","Pembrook","Sandoval","Tillman","Underwood",
        "Vickers","Waller","Yates","Zeller","Abernathy","Baptiste","Crawford","Dunbar","Easton","Fairbanks","Galloway","Hendricks",
        "Ingram","Jarrett","Kessler","Lockhart","Mabry","Northcott","Oakes","Pryor","Quintero","Rutledge","Stafford","Treadwell",
        "Upshaw","Valdez","Winslow"]
ENTERTAIN = [("Actor","film and television"),("Musician","Grammy-winning artist"),("Comedian","stand-up and late night"),
             ("Broadcaster","network anchor"),("Chef","restaurateur and TV host")]
CHARITIES = ["Mind Forward Foundation","The Quiet Room Project","Open Fairways Mental Health Fund","Second Half Wellbeing",
             "Locker Room Talks","Still Standing Initiative","Hometown Minds","The Long Game Trust","Clear Skies Collective"]
SPONSORS = ["Harbor & Finch","Northline Capital","Meridian Air","Cobalt Motors","Ridgeway Spirits","Summit Insurance","Kestrel Golf",
            "Oakfield Bank","Pacific Rail","Atlas Home","Everlight Energy","Blue Heron Resorts"]

used = set()
def name():
    while True:
        n = f"{random.choice(FIRST)} {random.choice(LAST)}"
        if n not in used:
            used.add(n); return n

players = []
pid = 1000
for c in CITIES:
    n = random.choice([6, 7, 7, 8])
    roster = []
    for i in range(n):
        pid += 1
        is_celeb = i == n - 1 and random.random() < .85
        if is_celeb:
            kind, blurb = random.choice(ENTERTAIN)
            team, sport, pos = None, "Entertainment", kind
            years = ""
            bio = f"{kind.capitalize()}, {blurb}. Grew up in {c['name']} and never left it behind; plays off a {random.choice([8,10,12,14])} handicap and talks about it."
        else:
            team = random.choice(c["teams"])
            sport = SPORT_OF[team] if not (c["id"] == "dal" and team == "Rangers") else "MLB"
            pos = random.choice(POS[sport])
            y0 = random.randint(1988, 2012); y1 = y0 + random.randint(6, 15)
            years = f"{y0}–{y1}"
            honours = random.choice(["Hall of Fame", "All-Star", "All-Star", "Champion", "Hall of Fame"])
            bio = f"{pos} for the {c['name']} {team}, {years}. {honours}. Took up golf seriously after retiring and now plays for the city that cheered him on."
        # skill: handicap index 2..18, celebs a bit higher
        hcp = round(random.uniform(1.5, 12.5) + (3 if is_celeb else 0), 1)
        roster.append(dict(id=f"p{pid}", name=name(), city=c["id"], sport=sport, team=team, role=pos, years=years,
                           honours=(None if is_celeb else honours), handicap=hcp, bio=bio,
                           captain=False))
    # captain = lowest handicap athlete
    cap = min([p for p in roster if p["sport"] != "Entertainment"], key=lambda p: p["handicap"])
    cap["captain"] = True
    c["captain"] = cap["id"]
    c["charity"] = CHARITIES[CITIES.index(c)]
    c["sponsors"] = random.sample(SPONSORS, 3)
    c["story"] = (f"{c['name']} plays for the fans who stayed. {', '.join(c['teams'][:-1])} and {c['teams'][-1]} legends "
                  f"share one bag, one city and one cause: {c['charity']}, which the team funds with every point it scores.")
    players += roster


# ------------------------------------------------------------------ stories
# The editorial layer: what the 3-5 editors publish once for web and app.
# kind: video | gallery | article | quote | result(data-driven) ; topic: league | city | mission
def P(cid, i):  # i-th player of a city (by roster order)
    return [x["id"] for x in players if x["city"] == cid][i]
STORIES = [
 dict(id="s00", kind="article", topic="league", at="2027-01-29T11:00", author="Legacy League", title="Jonathan Schecter named Chief Product Officer", dek="He led the build of the fan platform you are reading this on: website, apps and live scoring, from brief to Mayakoba in ten weeks. Now he owns the product roadmap for all eighteen markets.", cities=[], players=[], likes=1480, comments=67, photo="img/people/jonathan-schecter.jpg", focus="50% 12%", size="p", body=["{author} today named Jonathan Schecter Chief Product Officer. Schecter joined the league ahead of the Del Mar exhibition and led the delivery of the fan platform: the website, the iOS and Android apps and the live scoring experience, from the first brief to the Mayakoba launch in ten weeks.", "In the new role he owns the product roadmap across all planned markets, including the player area, the documentary programme and the data partnerships the league intends to build on through 2027. “The job now is to make this feel like home for nine cities, and then eighteen,” he said."]),
 dict(id="s01", kind="result", topic="league", at="2027-01-29T13:55", author="Legacy League", title="Round 2 is live from El Camaleón", dek="Auto-published from the scoring feed: the board as it stands, updated with every hole.", cities=[], players=[], body=["This board updates with every hole the scoring provider posts. A hole counts for a city only when all of its players have finished it; holes where two balls are in but team-mates are still on the course show as provisional in the detail view and never on the board.", "League points shown here are the points each city would receive at its current position. They are shared on ties and become final when the last group signs."]),
 dict(id="s02", kind="video", topic="city", at="2027-01-29T12:10", author="Dallas desk", title="Ingram's eagle on 13, from three angles", dek="The captain had not made an eagle since Del Mar. Then he hit a 5-wood to six feet.", cities=["dal"], players=[P("dal",0)], dur="0:48", likes=2140, comments=96, body=["The 13th at El Camaleón is the par five everyone circles: 532 yards, reachable with a good drive, water left of the green. {p0} found the fairway, then hit a 5-wood that never left the flag and stopped six feet past.", "The putt went in dead centre and the team line for {c0} dropped two shots in one hole. It was the first eagle of the league season and, by the captain's own count, his first since the Del Mar exhibition."]),
 dict(id="s03", kind="article", topic="league", at="2027-01-29T09:30", author="Legacy League", title="Round 1 recap: Dallas lead a bunched field at −17", dek="Five cities inside four shots. Chicago's back nine of −9 was the round of the day; Miami lost two balls to the wind on 16 and never recovered.", cities=["dal","chi","mia"], players=[], likes=980, comments=41, body=["Five cities finished round one inside four shots of each other, which is roughly what the format promised. Dallas led after a steady day in which seven players contributed at least one counted ball, and nobody posted worse than a bogey on a counted hole.", "Chicago were the movers. A back nine of nine under, built on three birdies in a row from the 14th, took them from the middle of the board to second. Miami's two lost balls on 16, both to the same gust, cost them a counted double and the chance of a top-five start."]),
 dict(id="s04", kind="gallery", topic="city", at="2027-01-28T21:05", author="Legacy League", title="Celebrity-Am at Mayakoba: 24 pictures", dek="The night before it counts. Pairings dinner on the beach, the Am draw, and a very long putt from a very famous comedian.", cities=["lax","nyc","mia"], players=[P("lax",5), P("mia",3)], count=24, likes=3310, comments=128, body=["The Celebrity-Am is the one day of the week with no points on the line and the only one where the crowd is allowed inside the ropes. Twenty-four pictures from an evening that started with the pairings draw on the beach and ended with a very long putt from a very famous comedian.", "Every picture in this gallery is tagged by city and player, so it also appears on the hubs and the player cards of everyone in it."]),
 dict(id="s05", kind="quote", topic="mission", at="2027-01-28T17:40", author="Legacy League · Mission", title="“The locker room was the loudest place I have ever been. Retirement was the quietest.”", dek="Episode 1 of Second Half, the league's series on athletes and mental health, is out now.", cities=["phi"], players=[P("phi",1)], likes=5120, comments=402, body=["Second Half is the league's series on what happens to athletes after the last game. Episode one follows {p0} through the two years after retirement, the silence after the locker room and the morning he first asked for help.", "The series is produced by the league and will stay free to watch. If any of this is close to home, the 988 Suicide & Crisis Lifeline answers calls and texts in the United States at any hour."]),
 dict(id="s06", kind="video", topic="mission", at="2027-01-28T17:30", author="Legacy League · Mission", title="Second Half · Episode 1", dek="Twenty-two minutes with the Philadelphia captain on the two years after the last game.", cities=["phi"], players=[P("phi",0)], dur="22:14", likes=4410, comments=310, body=["Twenty-two minutes with the {c0} captain, filmed over three days at home and on the range. He talks about the schedule that disappeared, the identity that went with it, and the friend who made him pick up a golf club again.", "Watch with captions in English and Spanish. The next episode follows a player from another city and will be published after the next event."]),
 dict(id="s07", kind="video", topic="city", at="2027-01-28T15:00", author="Chicago desk", title="Chicago's back nine, hole by hole", dek="Nine holes, nine under. Every counted ball and who made it.", cities=["chi"], players=[P("chi",0), P("chi",2)], dur="3:02", likes=1760, comments=73, body=["Nine holes, nine under. This cut shows every counted ball on Chicago's back nine on Thursday: who hit it, from where, and which of the two scores it replaced on the team card.", "The run started with three birdies in a row from the 14th and ended with the captain's long two-putt on 18 that kept the par and the position."]),
 dict(id="s08", kind="article", topic="league", at="2027-01-28T07:00", author="Legacy League", title="Pairings and tee times for Round 1", dek="Groups of three, one city each, off the first tee from 08:00 local. Follow your city to get your times pushed.", cities=[], players=[], likes=620, comments=18, body=["Groups of three, one player from each city, off the first tee from 08:00 local time at eleven-minute intervals. Captains were drawn into the first seven groups so that every city has a counted score on the board early.", "Follow your city and tee times will be pushed to you the evening before each round, together with the round leaders and the final result."]),
 dict(id="s09", kind="gallery", topic="city", at="2027-01-27T20:30", author="Boston desk", title="Boston arrive: the welcome at Mayakoba", dek="Eight players, one green jacket that is definitely not that green jacket.", cities=["bos"], players=[P("bos",0), P("bos",1)], count=12, likes=1420, comments=55, body=["Boston arrived on Tuesday evening with eight players and a kit bag that produced a green jacket of uncertain provenance. The welcome at the resort included a mariachi version of a song the Celtics crowd would recognise.", "Twelve pictures from the arrival evening and the first practice round."]),
 dict(id="s10", kind="video", topic="city", at="2027-01-27T16:00", author="Legacy League", title="City documentary: New York, trailer", dek="Six boroughs, five franchises, one team. The first of nine city films, coming through the season.", cities=["nyc"], players=[], dur="1:30", likes=2980, comments=140, body=["The first of nine city films, one per market, each telling the story of a city through the athletes who played for it and the charity its team supports. New York goes first because New York insisted.", "The full film premieres on this platform in March. The trailer is ninety seconds and ends on a shot of the 7 train."]),
 dict(id="s11", kind="article", topic="league", at="2027-01-26T18:00", author="Legacy League", title="How team best ball works, in ninety seconds", dek="Two balls count on every hole. Ties share the points. The rulebook, explained by the people who have to live with it.", cities=[], players=[], likes=870, comments=64, body=["Every city fields six to eight players. On each hole, the best two scores among them count toward the team total; the others are discarded. Two rounds make an event, and the event finishing positions convert to league points on a fixed table.", "Ties share the points on offer. The season champion is the city with the most points after five events; the Team Championship in October is played for a separate purse."]),
 dict(id="s12", kind="video", topic="city", at="2027-01-26T12:00", author="Los Angeles desk", title="Captain's round · Episode 1", dek="A practice round at El Camaleón with the LA captain and a microphone. Language mostly clean.", cities=["lax"], players=[P("lax",0)], dur="11:40", likes=1230, comments=47, body=["A practice round with the {c0} captain and a microphone, filmed the day before the Celebrity-Am. He explains how he picks his playing order, why the par threes at El Camaleón scare him more than the par fives, and what he says to a team-mate who has just made a double.", "Language mostly clean. Episode two is filmed at the next event."]),
 dict(id="s13", kind="quote", topic="city", at="2027-01-25T19:20", author="Detroit desk", title="“I played fourteen years in that city. I owe it a few birdies.”", dek="Detroit's captain on why he said yes.", cities=["det"], players=[P("det",0)], likes=2210, comments=88, body=["{p0} played fourteen seasons in Detroit and never considered playing for anyone else, in any sport. Asked why he said yes to a golf league, the answer took four seconds.", "The full interview runs on the Detroit hub, together with the roster and the city's charity partner."]),
 dict(id="s14", kind="gallery", topic="league", at="2027-01-25T15:00", author="Legacy League", title="The course: El Camaleón in 18 frames", dek="Mangroves, cenotes and a par 3 over the beach. Hole by hole, before anyone had made a bogey on it.", cities=[], players=[], count=18, likes=1980, comments=36, body=["Eighteen frames, one per hole, taken on Monday before the first practice ball. Mangroves on the front nine, a cenote beside the seventh fairway, and the fifteenth, a par three played over the beach with the wind doing whatever it likes.", "Yardages shown are from the tournament tees used this week: 7,034 yards, par 71."]),
 dict(id="s15", kind="article", topic="mission", at="2027-01-24T10:00", author="Legacy League · Mission", title="Every point scored this week funds a city charity", dek="Nine partners, one per city, named by the players. Here is who they are and what the money does.", cities=[], players=[], likes=1540, comments=52, body=["Each city's team plays for one charity, named by the players, working on mental health in that city. A fixed share of the league points a team scores converts into funding at the end of the season, and every event adds a city-specific grant on top.", "The nine partners are listed on the Mission page with what the money does. Donations from fans open later in the season."]),
 dict(id="s16", kind="video", topic="league", at="2026-11-16T20:00", author="Legacy League", title="Del Mar highlights: the exhibition that started it", dek="Eight minutes from November's test event in San Diego, where the format was tried and the cities were announced.", cities=[], players=[], dur="8:12", likes=6400, comments=510, body=["Del Mar in November was the dress rehearsal: two rounds, nine cities, the format tested in front of a real crowd for the first time. The eight minutes here cover the shots that mattered and the moment the cities were announced.", "Everything learned at Del Mar, from the pace of play to how scores reach this app, went into the way Mayakoba is run."]),
 dict(id="s17", kind="video", topic="city", at="2026-11-16T18:00", author="San Francisco desk", title="San Francisco at Del Mar", dek="The 49ers legend who had never played in front of a crowd. Until the 18th.", cities=["sfo"], players=[P("sfo",0)], dur="2:40", likes=1870, comments=71, body=["{p0} had played a lot of golf, none of it in front of people. The 18th at Del Mar fixed that: a crowd three deep around the green and a chip that stopped a foot from the hole.", "The clip, and his reaction, became the most shared piece of the exhibition."]),
 dict(id="s18", kind="gallery", topic="city", at="2026-11-15T22:00", author="Miami desk", title="Miami's roster, announced", dek="Dolphins, Heat and Marlins. Seven players, one broadcaster, zero handicaps under five.", cities=["mia"], players=[P("mia",0), P("mia",1), P("mia",2)], count=9, likes=1120, comments=39, body=["Dolphins, Heat and Marlins. Seven players and one broadcaster who insists he is the best putter on the team. Miami's roster was the last of the nine to be announced and the first to sell out its Celebrity-Am places.", "Nine portraits from the announcement day, tagged to each player's card."]),
]


# ------------------------------------------------------------------ photos
# Local illustration only (PGA TOUR course photos from the golf film + a few
# Wikimedia Commons action shots). Not cleared for publication.
import glob as _glob
COURSE = sorted(_glob.glob(str(ROOT / "img/course/*.webp")))
ACTION = sorted(_glob.glob(str(ROOT / "img/action/*.jpg")))
POOL = [str(pathlib.Path(x).relative_to(ROOT)) for x in (ACTION + COURSE)]
random.shuffle(POOL)
_pi = 0
def photo():
    global _pi
    x = POOL[_pi % len(POOL)]; _pi += 1; return x
SIZES = {"result": "r", "video": "l", "gallery": "m", "article": "m", "quote": "m"}
for i, st in enumerate(STORIES):
    st.setdefault("photo", photo())
    st["photos"] = [st["photo"], photo(), photo()] if st["kind"] == "gallery" else []
    if "size" in st: continue
    st["size"] = "xl" if i == 2 else "l" if st["id"] in ("s03", "s16", "s06") else "s" if st["id"] in ("s08", "s11") else SIZES[st["kind"]]
for c in CITIES:
    c["photos"] = [photo(), photo(), photo()]
HERO = [photo(), photo(), photo(), photo()]
# headshots: PGA TOUR faces/cutouts from the golf film, one per fictional player (local illustration only)
FACES = sorted(pathlib.Path(x).stem for x in _glob.glob(str(ROOT / "img/faces/*.webp")))
random.shuffle(FACES)
for i, pl in enumerate(players):
    pl["face"] = f"img/faces/{FACES[i % len(FACES)]}.webp"
    pl["full"] = f"img/full/{FACES[i % len(FACES)]}.webp"


# ----------------------------------------------------------------- schedule
SCHEDULE = [
 dict(n=1, id="mayakoba-2027", name="Mayakoba",          venue="El Camaleón Golf Club", city="Riviera Maya, Mexico", start="2027-01-24", end="2027-01-29", status="live"),
 dict(n=2, id="event-2",       name="Event 2",           venue="TBA",                         city="TBA", start="2027-03-07", end="2027-03-12", status="upcoming"),
 dict(n=3, id="event-3",       name="Event 3",           venue="TBA",                         city="TBA", start="2027-04-18", end="2027-04-23", status="upcoming"),
 dict(n=4, id="event-4",       name="Event 4",           venue="TBA",                         city="TBA", start="2027-06-06", end="2027-06-11", status="upcoming"),
 dict(n=5, id="event-5",       name="Event 5",           venue="TBA",                         city="TBA", start="2027-08-22", end="2027-08-27", status="upcoming"),
 dict(n=6, id="team-championship-2027", name="Team Championship", venue="TBA",               city="TBA", start="2027-10-10", end="2027-10-15", status="upcoming"),
]
RULES = dict(format="team_best_ball", best_balls=2, counting_rounds=2,
             points=[100, 80, 65, 55, 45, 38, 32, 27, 22], tie_rule="shared_average",
             note="Administrator-editable in the CMS: best balls counted per hole, points table, tie handling.")

# -------------------------------------------------------------------- feed
def hole_score(par, skill, pressure=0.0):
    """One hole for one player. skill = expected strokes over par per round (2..16)."""
    base = skill / 18.0 + pressure
    r = random.random()
    # distribution relative to par
    p_eagle = 0.012 if par == 5 else 0.004
    p_birdie = max(0.025, 0.15 - base * 0.12)
    p_par = max(0.24, 0.50 - base * 0.22)
    p_bogey = 0.28 + base * 0.12
    if r < p_eagle: d = -2
    elif r < p_eagle + p_birdie: d = -1
    elif r < p_eagle + p_birdie + p_par: d = 0
    elif r < p_eagle + p_birdie + p_par + p_bogey: d = 1
    else: d = 2 if random.random() < .72 else 3
    return par + d

skill = {p["id"]: p["handicap"] * 1.15 + random.uniform(-1, 1) for p in players}

# pairings: groups of 3, one player per city where possible, 11-minute intervals from 08:00
def make_tee_sheet(round_id, day):
    pool = {c["id"]: [p["id"] for p in players if p["city"] == c["id"]] for c in CITIES}
    for v in pool.values(): random.shuffle(v)
    groups = []
    while any(pool.values()):
        cities = sorted([k for k, v in pool.items() if v], key=lambda k: -len(pool[k]))
        g = [pool[k].pop() for k in cities[:3]]
        groups.append(g)
    sheet = []
    t = dt.datetime.fromisoformat(f"{day}T08:00:00")
    for i, g in enumerate(groups):
        sheet.append(dict(round_id=round_id, pairing_group_id=f"{round_id}-g{i+1:02d}", tee_time=t.isoformat(),
                          starting_hole=1, players=[dict(id=x, team_id=next(p["city"] for p in players if p["id"] == x)) for x in g]))
        t += dt.timedelta(minutes=11)
    return sheet

ROUNDS = [dict(id="r1", index=1, name="Round 1", date="2027-01-28", status="completed"),
          dict(id="r2", index=2, name="Round 2", date="2027-01-29", status="in_progress")]
tee_sheet = make_tee_sheet("r1", "2027-01-28") + make_tee_sheet("r2", "2027-01-29")

# hole-by-hole for every player, both rounds. Round 2 is generated in full; the
# client reveals holes against a simulated clock (tee time + 13 min per hole).
scores = []
for rd in ROUNDS:
    for p in players:
        pressure = 0.03 if rd["id"] == "r2" else 0.0
        hs = [hole_score(par, skill[p["id"]], pressure) for par in PAR]
        scores.append(dict(round_id=rd["id"], player_id=p["id"], team_id=p["city"], hole_scores=hs,
                           status="F" if rd["id"] == "r1" else "in_progress"))

feed = dict(
    provider="golfgenius", api_version="v2 (modelled)", generated_at="2027-01-29T14:20:00-05:00",
    event=dict(id="legacy-2027-01", name="Legacy League Golf — Mayakoba", start_date="2027-01-24", end_date="2027-01-29",
               course=dict(name="El Camaleón Golf Club", location="Mayakoba, Riviera Maya, Mexico", par=71, yardage=7034,
                           holes=[dict(number=n, par=p, yardage=y) for n, p, y in HOLES])),
    rounds=ROUNDS, tee_sheet=tee_sheet, scores=scores,
    sim=dict(clock_start="2027-01-29T14:20:00", minutes_per_hole=13, timezone="America/Cancun"))

league = dict(league=dict(name="Legacy League Golf", season=2027, tagline="Cities. Legends. A cause.",
                          mission="A city-based celebrity team golf league with a mental health mission."),
              cities=CITIES, players=players, schedule=SCHEDULE, rules=RULES, stories=STORIES, hero=HERO,
              resources=[dict(name="988 Suicide & Crisis Lifeline", detail="Call or text 988 (US)", url="https://988lifeline.org")])

(ROOT / "data" / "league.json").write_text(json.dumps(league, indent=1, ensure_ascii=False))
(ROOT / "data" / "feed.json").write_text(json.dumps(feed, indent=1, ensure_ascii=False))
print(f"{len(players)} players, {len(tee_sheet)} tee-sheet groups, {len(scores)} score lines")
