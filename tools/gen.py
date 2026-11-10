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
 dict(id="atl", name="Atlanta",       short="ATL", color="#ce1141", color2="#13274f", teams=["Braves","Falcons","Hawks"]),
 dict(id="den", name="Denver",        short="DEN", color="#fb4f14", color2="#002244", teams=["Broncos","Nuggets","Rockies","Avalanche"]),
]
SPORT_OF = {"Bears":"NFL","Bulls":"NBA","Cubs":"MLB","White Sox":"MLB","Blackhawks":"NHL","Celtics":"NBA","Red Sox":"MLB",
 "Patriots":"NFL","Bruins":"NHL","Yankees":"MLB","Knicks":"NBA","Giants":"NFL","Jets":"NFL","Mets":"MLB","Rangers":"NHL",
 "Lakers":"NBA","Dodgers":"MLB","Rams":"NFL","Kings":"NHL","Cowboys":"NFL","Mavericks":"NBA","Stars":"NHL","Eagles":"NFL",
 "76ers":"NBA","Phillies":"MLB","Flyers":"NHL","Lions":"NFL","Pistons":"NBA","Tigers":"MLB","Red Wings":"NHL","49ers":"NFL",
 "Warriors":"NBA","Dolphins":"NFL","Heat":"NBA","Marlins":"MLB","Braves":"MLB","Falcons":"NFL","Hawks":"NBA",
 "Broncos":"NFL","Nuggets":"NBA","Rockies":"MLB","Avalanche":"NHL"}
# Spanish labels for everything the content team would localise in the CMS (field-level, EN fallback)
ROLE_ES = {"Quarterback":"Quarterback","Wide receiver":"Receptor abierto","Linebacker":"Linebacker","Running back":"Corredor",
 "Safety":"Safety","Tight end":"Ala cerrada","Offensive tackle":"Tackle ofensivo","Point guard":"Base","Shooting guard":"Escolta",
 "Forward":"Alero","Center":"Pívot","Pitcher":"Lanzador","Shortstop":"Campocorto","Outfielder":"Jardinero","Catcher":"Receptor",
 "First baseman":"Primera base","Centre":"Centro","Winger":"Extremo","Defenceman":"Defensa","Goaltender":"Portero",
 "Actor":"Actor","Musician":"Músico","Comedian":"Humorista","Broadcaster":"Presentador","Chef":"Chef"}
HON_ES = {"Hall of Fame":"Salón de la Fama","All-Star":"All-Star","Champion":"Campeón"}
BLURB_ES = {"film and television":"cine y televisión","Grammy-winning artist":"artista ganador de un Grammy",
 "stand-up and late night":"stand-up y late night","network anchor":"presentador de cadena nacional","restaurateur and TV host":"restaurador y presentador de TV"}
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
             "Locker Room Talks","Still Standing Initiative","Hometown Minds","The Long Game Trust","Clear Skies Collective",
             "Peachtree Minds","Mile High Open Door"]
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
            h = random.choice([8,10,12,14])
            bio = f"{kind.capitalize()}, {blurb}. Grew up in {c['name']} and never left it behind; plays off a {h} handicap and talks about it."
            bio_es = f"{ROLE_ES[kind]}, {BLURB_ES[blurb]}. Creció en {c['name']} y nunca se desprendió de la ciudad; juega con hándicap {h} y presume de ello."
        else:
            team = random.choice(c["teams"])
            sport = SPORT_OF[team] if not (c["id"] == "dal" and team == "Rangers") else "MLB"
            pos = random.choice(POS[sport])
            y0 = random.randint(1988, 2012); y1 = y0 + random.randint(6, 15)
            years = f"{y0}–{y1}"
            honours = random.choice(["Hall of Fame", "All-Star", "All-Star", "Champion", "Hall of Fame"])
            bio = f"{pos} for the {c['name']} {team}, {years}. {honours}. Took up golf seriously after retiring and now plays for the city that cheered him on."
            bio_es = f"{ROLE_ES[pos]} de los {c['name']} {team}, {years}. {HON_ES[honours]}. Se tomó el golf en serio al retirarse y hoy juega por la ciudad que lo aclamó."
        # skill: handicap index 2..18, celebs a bit higher
        hcp = round(random.uniform(1.5, 12.5) + (3 if is_celeb else 0), 1)
        roster.append(dict(id=f"p{pid}", name=name(), city=c["id"], sport=sport, team=team, role=pos, role_es=ROLE_ES[pos], years=years,
                           honours=(None if is_celeb else honours), honours_es=(None if is_celeb else HON_ES[honours]), handicap=hcp,
                           bio=bio, bio_es=bio_es, captain=False))
    # captain = lowest handicap athlete
    cap = min([p for p in roster if p["sport"] != "Entertainment"], key=lambda p: p["handicap"])
    cap["captain"] = True
    c["captain"] = cap["id"]
    c["charity"] = CHARITIES[CITIES.index(c)]
    c["sponsors"] = random.sample(SPONSORS, 3)
    c["story"] = (f"{c['name']} plays for the fans who stayed. {', '.join(c['teams'][:-1])} and {c['teams'][-1]} legends "
                  f"share one bag, one city and one cause: {c['charity']}, which the team funds with every point it scores.")
    c["story_es"] = (f"{c['name']} juega por los aficionados que se quedaron. Leyendas de {', '.join(c['teams'][:-1])} y {c['teams'][-1]} "
                     f"comparten una bolsa, una ciudad y una causa: {c['charity']}, que el equipo financia con cada punto que suma.")
    c["hub_sponsor"] = c["sponsors"][0]
    players += roster


# ------------------------------------------------------------------ stories
# The editorial layer: what the 3-5 editors publish once for web and app.
# kind: video | gallery | article | quote | result(data-driven) ; topic: league | city | mission
def P(cid, i):  # i-th player of a city (by roster order)
    return [x["id"] for x in players if x["city"] == cid][i]
STORIES = [
 dict(id="s01", kind="result", topic="league", at="2027-01-29T13:55", author="Legacy League", title="Round 2 is live from El Camaleón", dek="Auto-published from the scoring feed: the board as it stands, updated with every hole.", cities=[], players=[], body=["This board updates with every hole the scoring provider posts. A hole counts for a city only when all of its players have finished it; holes where two balls are in but team-mates are still on the course show as provisional in the detail view and never on the board.", "League points shown here are the points each city would receive at its current position. They are shared on ties and become final when the last group signs."]),
 dict(id="s02", kind="video", topic="city", at="2027-01-29T12:10", author="Dallas desk", title="{p0}'s eagle on 13, from three angles", dek="The captain had not made an eagle since Del Mar. Then he hit a 5-wood to six feet.", cities=["dal"], players=[P("dal",0)], dur="0:48", likes=2140, comments=96, body=["The 13th at El Camaleón is the par five everyone circles: 532 yards, reachable with a good drive, water left of the green. {p0} found the fairway, then hit a 5-wood that never left the flag and stopped six feet past.", "The putt went in dead centre and the team line for {c0} dropped two shots in one hole. It was the first eagle of the league season and, by the captain's own count, his first since the Del Mar exhibition."]),
 dict(id="s03", kind="article", topic="league", at="2027-01-29T09:30", author="Legacy League", title="Round 1 recap: Dallas lead a bunched field at −17", dek="Five cities inside four shots. Chicago's back nine of −9 was the round of the day; Miami lost two balls to the wind on 16 and never recovered.", cities=["dal","chi","mia"], players=[], likes=980, comments=41, body=["Five cities finished round one inside four shots of each other, which is roughly what the format promised. Dallas led after a steady day in which seven players contributed at least one counted ball, and nobody posted worse than a bogey on a counted hole.", "Chicago were the movers. A back nine of nine under, built on three birdies in a row from the 14th, took them from the middle of the board to second. Miami's two lost balls on 16, both to the same gust, cost them a counted double and the chance of a top-five start."]),
 dict(id="s04", kind="gallery", topic="city", at="2027-01-28T21:05", author="Legacy League", title="Celebrity-Am at Mayakoba: 24 pictures", dek="The night before it counts. Pairings dinner on the beach, the Am draw, and a very long putt from a very famous comedian.", cities=["lax","nyc","mia"], players=[P("lax",5), P("mia",3)], count=24, likes=3310, comments=128, body=["The Celebrity-Am is the one day of the week with no points on the line and the only one where the crowd is allowed inside the ropes. Twenty-four pictures from an evening that started with the pairings draw on the beach and ended with a very long putt from a very famous comedian.", "Every picture in this gallery is tagged by city and player, so it also appears on the hubs and the player cards of everyone in it."]),
 dict(id="s05", kind="quote", topic="mission", at="2027-01-28T17:40", author="Legacy League · Mission", title="“The locker room was the loudest place I have ever been. Retirement was the quietest.”", dek="Episode 1 of Second Half, the league's series on athletes and mental health, is out now.", cities=["phi"], players=[P("phi",1)], likes=5120, comments=402, body=["Second Half is the league's series on what happens to athletes after the last game. Episode one follows {p0} through the two years after retirement, the silence after the locker room and the morning he first asked for help.", "The series is produced by the league and will stay free to watch. If any of this is close to home, the 988 Suicide & Crisis Lifeline answers calls and texts in the United States at any hour."]),
 dict(id="s06", kind="video", topic="mission", at="2027-01-28T17:30", author="Legacy League · Mission", title="Second Half · Episode 1", dek="Twenty-two minutes with the Philadelphia captain on the two years after the last game.", cities=["phi"], players=[P("phi",0)], dur="22:14", likes=4410, comments=310, body=["Twenty-two minutes with the {c0} captain, filmed over three days at home and on the range. He talks about the schedule that disappeared, the identity that went with it, and the friend who made him pick up a golf club again.", "Watch with captions in English and Spanish. The next episode follows a player from another city and will be published after the next event."]),
 dict(id="s07", kind="video", topic="city", at="2027-01-28T15:00", author="Chicago desk", title="Chicago's back nine, hole by hole", dek="Nine holes, nine under. Every counted ball and who made it.", cities=["chi"], players=[P("chi",0), P("chi",2)], dur="3:02", likes=1760, comments=73, body=["Nine holes, nine under. This cut shows every counted ball on Chicago's back nine on Thursday: who hit it, from where, and which of the two scores it replaced on the team card.", "The run started with three birdies in a row from the 14th and ended with the captain's long two-putt on 18 that kept the par and the position."]),
 dict(id="s08", kind="article", topic="league", at="2027-01-28T07:00", author="Legacy League", title="Pairings and tee times for Round 1", dek="Groups of three, one city each, off the first tee from 08:00 local. Follow your city to get your times pushed.", cities=[], players=[], likes=620, comments=18, body=["Groups of three, one player from each city, off the first tee from 08:00 local time at eleven-minute intervals. Captains were drawn into the first seven groups so that every city has a counted score on the board early.", "Follow your city and tee times will be pushed to you the evening before each round, together with the round leaders and the final result."]),
 dict(id="s09", kind="gallery", topic="city", at="2027-01-27T20:30", author="Boston desk", title="Boston arrive: the welcome at Mayakoba", dek="Eight players, one green jacket that is definitely not that green jacket.", cities=["bos"], players=[P("bos",0), P("bos",1)], count=12, likes=1420, comments=55, body=["Boston arrived on Tuesday evening with eight players and a kit bag that produced a green jacket of uncertain provenance. The welcome at the resort included a mariachi version of a song the Celtics crowd would recognise.", "Twelve pictures from the arrival evening and the first practice round."]),
 dict(id="s10", kind="video", topic="city", at="2027-01-27T16:00", author="Legacy League", title="City documentary: New York, trailer", dek="Six boroughs, five franchises, one team. The first of eleven city films, coming through the season.", cities=["nyc"], players=[], dur="1:30", likes=2980, comments=140, body=["The first of eleven city films, one per market, each telling the story of a city through the athletes who played for it and the charity its team supports. New York goes first because New York insisted.", "The full film premieres on this platform in March. The trailer is ninety seconds and ends on a shot of the 7 train."]),
 dict(id="s11", kind="article", topic="league", at="2027-01-26T18:00", author="Legacy League", title="How team best ball works, in ninety seconds", dek="Two balls count on every hole. Ties share the points. The rulebook, explained by the people who have to live with it.", cities=[], players=[], likes=870, comments=64, body=["Every city fields six to eight players. On each hole, the best two scores among them count toward the team total; the others are discarded. Two rounds make an event, and the event finishing positions convert to league points on a fixed table.", "Ties share the points on offer. The season champion is the city with the most points after five events; the Team Championship in October is played for a separate purse."]),
 dict(id="s12", kind="video", topic="city", at="2027-01-26T12:00", author="Los Angeles desk", title="Captain's round · Episode 1", dek="A practice round at El Camaleón with the LA captain and a microphone. Language mostly clean.", cities=["lax"], players=[P("lax",0)], dur="11:40", likes=1230, comments=47, body=["A practice round with the {c0} captain and a microphone, filmed the day before the Celebrity-Am. He explains how he picks his playing order, why the par threes at El Camaleón scare him more than the par fives, and what he says to a team-mate who has just made a double.", "Language mostly clean. Episode two is filmed at the next event."]),
 dict(id="s13", kind="quote", topic="city", at="2027-01-25T19:20", author="Detroit desk", title="“I played fourteen years in that city. I owe it a few birdies.”", dek="Detroit's captain on why he said yes.", cities=["det"], players=[P("det",0)], likes=2210, comments=88, body=["{p0} played fourteen seasons in Detroit and never considered playing for anyone else, in any sport. Asked why he said yes to a golf league, the answer took four seconds.", "The full interview runs on the Detroit hub, together with the roster and the city's charity partner."]),
 dict(id="s14", kind="gallery", topic="league", at="2027-01-25T15:00", author="Legacy League", title="The course: El Camaleón in 18 frames", dek="Mangroves, cenotes and a par 3 over the beach. Hole by hole, before anyone had made a bogey on it.", cities=[], players=[], count=18, likes=1980, comments=36, body=["Eighteen frames, one per hole, taken on Monday before the first practice ball. Mangroves on the front nine, a cenote beside the seventh fairway, and the fifteenth, a par three played over the beach with the wind doing whatever it likes.", "Yardages shown are from the tournament tees used this week: 7,034 yards, par 71."]),
 dict(id="s15", kind="article", topic="mission", at="2027-01-24T10:00", author="Legacy League · Mission", title="Every point scored this week funds a city charity", dek="Eleven partners, one per city, named by the players. Here is who they are and what the money does.", cities=[], players=[], likes=1540, comments=52, body=["Each city's team plays for one charity, named by the players, working on mental health in that city. A fixed share of the league points a team scores converts into funding at the end of the season, and every event adds a city-specific grant on top.", "The eleven partners are listed on the Mission page with what the money does. Donations from fans open later in the season."]),
 dict(id="s16", kind="video", topic="league", at="2026-11-16T20:00", author="Legacy League", title="Del Mar highlights: the exhibition that started it", dek="Eight minutes from November's test event in San Diego, where the format was tried and the cities were announced.", cities=[], players=[], dur="8:12", likes=6400, comments=510, body=["Del Mar in November was the dress rehearsal: two rounds, eleven cities, the format tested in front of a real crowd for the first time. The eight minutes here cover the shots that mattered and the moment the cities were announced.", "Everything learned at Del Mar, from the pace of play to how scores reach this app, went into the way Mayakoba is run."]),
 dict(id="s17", kind="video", topic="city", at="2026-11-16T18:00", author="San Francisco desk", title="San Francisco at Del Mar", dek="The 49ers legend who had never played in front of a crowd. Until the 18th.", cities=["sfo"], players=[P("sfo",0)], dur="2:40", likes=1870, comments=71, body=["{p0} had played a lot of golf, none of it in front of people. The 18th at Del Mar fixed that: a crowd three deep around the green and a chip that stopped a foot from the hole.", "The clip, and his reaction, became the most shared piece of the exhibition."]),
 dict(id="s18", kind="gallery", topic="city", at="2026-11-15T22:00", author="Miami desk", title="Miami's roster, announced", dek="Dolphins, Heat and Marlins. Seven players, one broadcaster, zero handicaps under five.", cities=["mia"], players=[P("mia",0), P("mia",1), P("mia",2)], count=9, likes=1120, comments=39, body=["Dolphins, Heat and Marlins. Seven players and one broadcaster who insists he is the best putter on the team. Miami's roster was the last of the eleven to be announced and the first to sell out its Celebrity-Am places.", "Nine portraits from the announcement day, tagged to each player's card."]),
]


# Spanish fields, as the CMS would hold them (title_es / dek_es / body_es); the UI falls back to English.
ES = {
 "s01": dict(title="La Ronda 2 está en directo desde El Camaleón", dek="Publicado automáticamente desde el feed de resultados: la clasificación tal como está, actualizada hoyo a hoyo.", body=["Esta clasificación se actualiza con cada hoyo que publica el proveedor de resultados. Un hoyo cuenta para una ciudad solo cuando todos sus jugadores lo han terminado; los hoyos con dos bolas dentro pero compañeros aún en el campo aparecen como provisionales en el detalle y nunca en la clasificación.", "Los puntos de liga que se muestran son los que recibiría cada ciudad en su posición actual. Se reparten en caso de empate y son definitivos cuando firma el último grupo."]),
 "s02": dict(title="El eagle de {p0} en el 13, desde tres ángulos", dek="El capitán no hacía un eagle desde Del Mar. Entonces pegó una madera 5 a dos metros.", body=["El 13 de El Camaleón es el par cinco que todos marcan: 532 yardas, alcanzable con un buen drive, agua a la izquierda del green. {p0} encontró la calle y pegó una madera 5 que nunca se separó de la bandera y se paró a dos metros.", "El putt entró por el centro y la línea de equipo de {c0} bajó dos golpes en un solo hoyo. Fue el primer eagle de la temporada de liga y, según el propio capitán, el primero desde la exhibición de Del Mar."]),
 "s03": dict(title="Resumen de la Ronda 1: Dallas lidera un pelotón apretado con −17", dek="Cinco ciudades en cuatro golpes. Los −9 de Chicago en la segunda vuelta fueron la vuelta del día; Miami perdió dos bolas con el viento en el 16 y no se recuperó.", body=["Cinco ciudades terminaron la primera ronda a menos de cuatro golpes entre sí, que es más o menos lo que prometía el formato. Dallas lideró tras un día sólido en el que siete jugadores aportaron al menos una bola contada y nadie firmó peor que bogey en un hoyo contado.", "Chicago fue el equipo que más se movió. Una segunda vuelta de nueve bajo par, construida sobre tres birdies seguidos desde el 14, los llevó de la mitad de la tabla al segundo puesto. Las dos bolas que Miami perdió en el 16, ambas con la misma racha de viento, les costaron un doble contado y la opción de empezar entre los cinco primeros."]),
 "s04": dict(title="Celebrity-Am en Mayakoba: 24 fotos", dek="La noche antes de que cuente. Cena de emparejamientos en la playa, el sorteo del Am y un putt muy largo de un humorista muy famoso.", body=["El Celebrity-Am es el único día de la semana sin puntos en juego y el único en que el público puede entrar dentro de las cuerdas. Veinticuatro fotos de una velada que empezó con el sorteo de emparejamientos en la playa y terminó con un putt muy largo de un humorista muy famoso.", "Cada foto de esta galería está etiquetada por ciudad y jugador, así que aparece también en los hubs y en las fichas de todos los que salen en ella."]),
 "s05": dict(title="«El vestuario era el lugar más ruidoso en el que he estado. La retirada fue el más silencioso.»", dek="Ya está disponible el episodio 1 de Second Half, la serie de la liga sobre deportistas y salud mental.", body=["Second Half es la serie de la liga sobre lo que les pasa a los deportistas después del último partido. El primer episodio sigue a {p0} durante los dos años posteriores a su retirada, el silencio tras el vestuario y la mañana en que pidió ayuda por primera vez.", "La serie la produce la liga y seguirá siendo gratuita. Si algo de esto te toca de cerca, la línea 988 Suicide & Crisis Lifeline atiende llamadas y mensajes en Estados Unidos a cualquier hora."]),
 "s06": dict(title="Second Half · Episodio 1", dek="Veintidós minutos con el capitán de Filadelfia sobre los dos años posteriores al último partido.", body=["Veintidós minutos con el capitán de {c0}, grabados durante tres días en su casa y en el campo de prácticas. Habla del calendario que desapareció, de la identidad que se fue con él y del amigo que le hizo volver a coger un palo de golf.", "Disponible con subtítulos en inglés y español. El siguiente episodio sigue a un jugador de otra ciudad y se publicará tras el próximo evento."]),
 "s07": dict(title="La segunda vuelta de Chicago, hoyo a hoyo", dek="Nueve hoyos, nueve bajo par. Cada bola contada y quién la hizo.", body=["Nueve hoyos, nueve bajo par. Este montaje muestra cada bola contada de la segunda vuelta de Chicago el jueves: quién la pegó, desde dónde y a cuál de los dos resultados sustituyó en la tarjeta del equipo.", "La racha empezó con tres birdies seguidos desde el 14 y terminó con el largo dos putts del capitán en el 18 que salvó el par y la posición."]),
 "s08": dict(title="Emparejamientos y horarios de salida de la Ronda 1", dek="Grupos de tres, una ciudad cada uno, desde el tee del 1 a partir de las 08:00 hora local. Sigue a tu ciudad para recibir tus horarios.", body=["Grupos de tres, un jugador de cada ciudad, desde el tee del 1 a partir de las 08:00 hora local, con intervalos de once minutos. Los capitanes se sortearon en los siete primeros grupos para que cada ciudad tenga pronto un resultado contado en la clasificación.", "Sigue a tu ciudad y recibirás los horarios de salida la víspera de cada ronda, junto con los líderes de la ronda y el resultado final."]),
 "s09": dict(title="Boston llega: la bienvenida en Mayakoba", dek="Ocho jugadores y una chaqueta verde que definitivamente no es esa chaqueta verde.", body=["Boston llegó el martes por la noche con ocho jugadores y una bolsa de la que salió una chaqueta verde de procedencia incierta. La bienvenida en el resort incluyó una versión mariachi de una canción que la afición de los Celtics reconocería.", "Doce fotos de la noche de llegada y de la primera vuelta de prácticas."]),
 "s10": dict(title="Documental de ciudad: Nueva York, tráiler", dek="Seis distritos, cinco franquicias, un equipo. La primera de once películas de ciudad, a lo largo de la temporada.", body=["La primera de once películas de ciudad, una por mercado, cada una contando la historia de una ciudad a través de los deportistas que jugaron por ella y de la organización benéfica a la que apoya su equipo. Nueva York va primero porque Nueva York insistió.", "La película completa se estrena en esta plataforma en marzo. El tráiler dura noventa segundos y termina con un plano del tren 7."]),
 "s11": dict(title="Cómo funciona el team best ball, en noventa segundos", dek="En cada hoyo cuentan dos bolas. Los empates reparten los puntos. El reglamento, explicado por quienes tienen que vivir con él.", body=["Cada ciudad alinea entre seis y ocho jugadores. En cada hoyo cuentan los dos mejores resultados del equipo; los demás se descartan. Dos rondas hacen un evento, y las posiciones finales del evento se convierten en puntos de liga según una tabla fija.", "Los empates reparten los puntos en juego. El campeón de la temporada es la ciudad con más puntos tras cinco eventos; el Campeonato por Equipos de octubre se juega por una bolsa de premios aparte."]),
 "s12": dict(title="La vuelta del capitán · Episodio 1", dek="Una vuelta de prácticas en El Camaleón con el capitán de LA y un micrófono. Lenguaje casi siempre limpio.", body=["Una vuelta de prácticas con el capitán de {c0} y un micrófono, grabada el día antes del Celebrity-Am. Explica cómo elige el orden de juego, por qué los pares tres de El Camaleón le asustan más que los pares cinco y qué le dice a un compañero que acaba de hacer un doble bogey.", "Lenguaje casi siempre limpio. El segundo episodio se graba en el próximo evento."]),
 "s13": dict(title="«Jugué catorce años en esa ciudad. Le debo unos cuantos birdies.»", dek="El capitán de Detroit explica por qué dijo que sí.", body=["{p0} jugó catorce temporadas en Detroit y nunca se planteó jugar para nadie más, en ningún deporte. Preguntado por qué dijo que sí a una liga de golf, la respuesta tardó cuatro segundos.", "La entrevista completa está en el hub de Detroit, junto con la plantilla y la organización benéfica de la ciudad."]),
 "s14": dict(title="El campo: El Camaleón en 18 imágenes", dek="Manglares, cenotes y un par 3 sobre la playa. Hoyo a hoyo, antes de que nadie hiciera un bogey en él.", body=["Dieciocho imágenes, una por hoyo, tomadas el lunes antes de la primera bola de prácticas. Manglares en la primera vuelta, un cenote junto a la calle del siete y el quince, un par tres que se juega sobre la playa con el viento haciendo lo que le apetece.", "Las distancias indicadas son desde los tees de torneo de esta semana: 7.034 yardas, par 71."]),
 "s15": dict(title="Cada punto sumado esta semana financia una organización de su ciudad", dek="Once socios, uno por ciudad, elegidos por los jugadores. Quiénes son y a qué se destina el dinero.", body=["El equipo de cada ciudad juega por una organización, elegida por los jugadores, que trabaja en salud mental en esa ciudad. Una parte fija de los puntos de liga que suma un equipo se convierte en financiación al final de la temporada, y cada evento añade además una ayuda específica para la ciudad.", "Los once socios aparecen en la página de la Misión con el detalle de a qué se destina el dinero. Las donaciones de los aficionados se abrirán más adelante en la temporada."]),
 "s16": dict(title="Lo mejor de Del Mar: la exhibición con la que empezó todo", dek="Ocho minutos del evento de prueba de noviembre en San Diego, donde se probó el formato y se anunciaron las ciudades.", body=["Del Mar, en noviembre, fue el ensayo general: dos rondas, once ciudades, el formato probado por primera vez ante público real. Los ocho minutos de este vídeo recogen los golpes que importaron y el momento en que se anunciaron las ciudades.", "Todo lo aprendido en Del Mar, desde el ritmo de juego hasta cómo llegan los resultados a esta app, se ha aplicado a la organización de Mayakoba."]),
 "s17": dict(title="San Francisco en Del Mar", dek="La leyenda de los 49ers que nunca había jugado ante público. Hasta el 18.", body=["{p0} había jugado mucho al golf, pero nunca delante de gente. El 18 de Del Mar lo arregló: un público de tres filas alrededor del green y un chip que se paró a treinta centímetros del hoyo.", "El clip, y su reacción, se convirtió en la pieza más compartida de la exhibición."]),
 "s18": dict(title="La plantilla de Miami, anunciada", dek="Dolphins, Heat y Marlins. Siete jugadores, un presentador, ningún hándicap por debajo de cinco.", body=["Dolphins, Heat y Marlins. Siete jugadores y un presentador que insiste en que es el mejor pateador del equipo. La plantilla de Miami fue la última de las once en anunciarse y la primera en agotar sus plazas del Celebrity-Am.", "Nueve retratos del día del anuncio, etiquetados a la ficha de cada jugador."]),
}
for st in STORIES:
    for k, v in ES.get(st["id"], {}).items(): st[k + "_es"] = v
# the one real clip: a Creative Commons golf swing (Wikimedia Commons, CC BY 4.0) with EN + ES caption tracks
for st in STORIES:
    if st["id"] == "s16":
        st["video"] = "img/video/swing.webm"; st["captions"] = ["en", "es"]; st["credit"] = "Clip: Nesnad, Wikimedia Commons, CC BY 4.0"

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
 dict(n=1, id="mayakoba-2027", name="Mayakoba", name_es="Mayakoba", venue="El Camaleón Golf Club", city="Riviera Maya, Mexico", city_es="Riviera Maya, México", start="2027-01-24", end="2027-01-29", status="live",
      programme=[
        dict(date="2027-01-24", en="Arrivals and practice", es="Llegadas y prácticas", core=False),
        dict(date="2027-01-25", en="Practice rounds · media day", es="Vueltas de prácticas · día de medios", core=False),
        dict(date="2027-01-26", en="Arrival evening and pairings party", es="Noche de llegada y fiesta de emparejamientos", core=True),
        dict(date="2027-01-27", en="Celebrity-Am", es="Celebrity-Am", core=True),
        dict(date="2027-01-28", en="Round 1 · live scoring from 08:00", es="Ronda 1 · resultados en directo desde las 08:00", core=True),
        dict(date="2027-01-29", en="Round 2 · city champion crowned", es="Ronda 2 · se corona al campeón de ciudad", core=True)],
      watch=dict(en="No broadcast partner has been appointed yet. Highlights are published here within the hour; the where-to-watch link appears when a partner is confirmed.",
                 es="Todavía no hay socio de televisión. Los resúmenes se publican aquí en menos de una hora; el enlace de dónde verlo aparecerá cuando se confirme un socio.")),
 dict(n=2, id="event-2",       name="Event 2", name_es="Evento 2",           venue="TBA", city="TBA", start="2027-03-07", end="2027-03-12", status="upcoming"),
 dict(n=3, id="event-3",       name="Event 3", name_es="Evento 3",           venue="TBA", city="TBA", start="2027-04-18", end="2027-04-23", status="upcoming"),
 dict(n=4, id="event-4",       name="Event 4", name_es="Evento 4",           venue="TBA", city="TBA", start="2027-06-06", end="2027-06-11", status="upcoming"),
 dict(n=5, id="event-5",       name="Event 5", name_es="Evento 5",           venue="TBA", city="TBA", start="2027-08-22", end="2027-08-27", status="upcoming"),
 dict(n=6, id="team-championship-2027", name="Team Championship", name_es="Campeonato por Equipos", venue="TBA", city="TBA", start="2027-10-10", end="2027-10-15", status="upcoming"),
]
RULES = dict(format="team_best_ball", best_balls=2, counting_rounds=2,
             points=[100, 80, 65, 55, 45, 38, 32, 27, 22, 18, 15], tie_rule="shared_average",
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
