// Cadence Music Starter Catalog & Playlists (With Dedicated Audio & Music Video IDs)

const YTM_DATA = {
  categories: [
    { id: 'all', label: 'All' },
    { id: 'energize', label: 'Energize' },
    { id: 'workout', label: 'Workout' },
    { id: 'relax', label: 'Relax' },
    { id: 'focus', label: 'Focus' },
    { id: 'commute', label: 'Commute' },
    { id: 'party', label: 'Party' }
  ],

  tracks: [
    {
      id: 'trk-1',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      duration: '3:20',
      durationSec: 200,
      ytId: 'J7p4bzqLvCw',
      audioId: 'J7p4bzqLvCw',        // Clean Studio Master
      musicVideoId: '4NRXx6U8ABQ',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/R_cjQK3wwLPEzri1jerx-79zgzGocoKvwGU3NMONaTsaMM0Idd641pfB8r5jgfpn6I8JAoFtf9RBIcI=w800-h800-l90-rj',
      category: 'energize',
      plays: '3.8B plays'
    },
    {
      id: 'trk-2',
      title: 'Starboy',
      artist: 'The Weeknd ft. Daft Punk',
      album: 'Starboy',
      duration: '3:50',
      durationSec: 230,
      ytId: '3_g2un5M350',
      audioId: '3_g2un5M350',        // Clean Studio Master
      musicVideoId: '34Na4j8AVgA',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/dcxXIIlest09vnvKznWM9VWQXu1EL7lKxBzXGzwgmVjmMNBm1dEWT_0qn1xrEZYyKF_qRE1TLq8P_JY_mQ=w800-h800-l90-rj',
      category: 'energize',
      plays: '2.5B plays'
    },
    {
      id: 'trk-3',
      title: 'Save Your Tears',
      artist: 'The Weeknd',
      album: 'After Hours',
      duration: '3:35',
      durationSec: 215,
      ytId: 'RmYCOm4ehKs',
      audioId: 'RmYCOm4ehKs',        // Clean Studio Master
      musicVideoId: 'XXYlFuWEuKI',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/JDKz3Anlyo49xBhFcFx13QD_Tk4-kqdiYTo15gtkL93nE8biWyZ7o0BPyW6RnXVxcXaJ5DgU5nJ_0NjJ=w800-h800-l90-rj',
      category: 'relax',
      plays: '1.9B plays'
    },
    {
      id: 'trk-4',
      title: 'Levitating',
      artist: 'Dua Lipa',
      album: 'Future Nostalgia',
      duration: '3:23',
      durationSec: 203,
      ytId: 'OsfAnsMY21M',
      audioId: 'OsfAnsMY21M',        // Clean Studio Master
      musicVideoId: 'TUVcZfQe-Kw',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/UpJ_IhBqyhQV9b2UGcDxxWDm14kRQ2eY1o9S96AGsbE7Ol8isbpbPA0Yefvg8S8ZGAX9L1g4xaj21zVJ=w800-h800-l90-rj',
      category: 'party',
      plays: '1.1B plays'
    },
    {
      id: 'trk-5',
      title: 'Stay',
      artist: 'The Kid LAROI, Justin Bieber',
      album: 'F*CK LOVE 3: OVER YOU',
      duration: '2:21',
      durationSec: 141,
      ytId: 'XfEMj-z3TtA',
      audioId: 'XfEMj-z3TtA',        // Clean Studio Master
      musicVideoId: 'kTJczUoc26U',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/_72AYxGc5r6U2SwbDvo8qLTx0wLp1bxRAQTSWNZfeZOdP2zf6yHjIAzTZCFILrbz3AvxHqHJdqde56Y=w800-h800-l90-rj',
      category: 'energize',
      plays: '2.8B plays'
    },
    {
      id: 'trk-6',
      title: 'As It Was',
      artist: 'Harry Styles',
      album: "Harry's House",
      duration: '2:47',
      durationSec: 167,
      ytId: 'nujn6wbr-e8',
      audioId: 'nujn6wbr-e8',        // Clean Studio Master
      musicVideoId: 'H5v3kku4y6Q',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/F618Qwn2yRlYhCqlMtEMnFHajg4rGZSGeWOF4ro7l3I9R6y7aGfowqqiNQqj6CgVR0yepTK6T5aRSfAF=w800-h800-l90-rj',
      category: 'relax',
      plays: '3.1B plays'
    },
    {
      id: 'trk-7',
      title: 'Heat Waves',
      artist: 'Glass Animals',
      album: 'Dreamland',
      duration: '3:59',
      durationSec: 239,
      ytId: 'XDjB9E3YtUE',
      audioId: 'XDjB9E3YtUE',        // Clean Studio Master
      musicVideoId: 'mRD0-GxqHVo',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/w9WrUTZckeY-PCYJsytiVyw5tVCtFsirBtnYGRvSIby3oRjYXHaszrbJsyfmZ6mdbE2UB-c7iqjJdR0=w800-h800-l90-rj',
      category: 'relax',
      plays: '2.7B plays'
    },
    {
      id: 'trk-8',
      title: 'Sunflower',
      artist: 'Post Malone, Swae Lee',
      album: 'Spider-Man: Into the Spider-Verse',
      duration: '2:38',
      durationSec: 158,
      ytId: 'r7Rn4ryE_w8',
      audioId: 'r7Rn4ryE_w8',        // Clean Studio Master
      musicVideoId: 'ApXoWvfEYVU',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/IBwK4LOs4sO-Cd-_5YO4XC2B2N1hvyBvKfr60tT_ljIuwmOuVWWW2NypbcvzKgScVAbRsWEYbmsjfcm2cw=w800-h800-l90-rj',
      category: 'commute',
      plays: '3.2B plays'
    },
    {
      id: 'trk-9',
      title: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up, We\'re Dreaming',
      duration: '4:03',
      durationSec: 243,
      ytId: 'M2q_m46wJ04',
      audioId: 'M2q_m46wJ04',        // Clean Studio Master
      musicVideoId: 'dX3k_QDnzHE',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/FtKxpe4wQSomNk3HGvUMyqHTyy6h56Oey4dJhPJeioRIMCvXVj1pRCHo1zBCTYYoRXQEVgNDfhB1Hg2O=w800-h800-l90-rj',
      category: 'workout',
      plays: '740M plays'
    },
    {
      id: 'trk-10',
      title: 'Flowers',
      artist: 'Miley Cyrus',
      album: 'Endless Summer Vacation',
      duration: '3:20',
      durationSec: 200,
      ytId: 'BkSSOGNeWTM',
      audioId: 'BkSSOGNeWTM',        // Clean Studio Master
      musicVideoId: 'G7KNmW9a75Y',   // Official Music Video
      cover: 'https://yt3.googleusercontent.com/umJNTu_qH_THEHP4XsOb4bMCjKn1nka4c8iz8Vs791pB5aroCWwq4aHC9ds5kCnONrgNUPgPadWnecak=w800-h800-l90-rj',
      category: 'workout',
      plays: '1.6B plays'
    },
    {
      id: 'trk-11',
      title: 'Die For You',
      artist: 'The Weeknd',
      album: 'Starboy',
      duration: '4:20',
      durationSec: 260,
      ytId: 'uPD0QOGUxAQ',
      audioId: 'uPD0QOGUxAQ',
      musicVideoId: 'QLCpqdqeoII',
      cover: 'https://yt3.googleusercontent.com/dcxXIIlest09vnvKznWM9VWQXu1EL7lKxBzXGzwgmVjmMNBm1dEWT_0qn1xrEZYyKF_qRE1TLq8P_JY_mQ=w800-h800-l90-rj',
      category: 'relax',
      plays: '2.1B plays'
    },
    {
      id: 'trk-12',
      title: 'One Dance',
      artist: 'Drake ft. Wizkid & Kyla',
      album: 'Views',
      duration: '2:53',
      durationSec: 173,
      ytId: 'iAbnEUA0wpA',
      audioId: 'iAbnEUA0wpA',
      musicVideoId: 'iAbnEUA0wpA',
      cover: 'https://yt3.googleusercontent.com/F618Qwn2yRlYhCqlMtEMnFHajg4rGZSGeWOF4ro7l3I9R6y7aGfowqqiNQqj6CgVR0yepTK6T5aRSfAF=w800-h800-l90-rj',
      category: 'party',
      plays: '3.1B plays'
    },
    {
      id: 'trk-13',
      title: 'Shape of You',
      artist: 'Ed Sheeran',
      album: '÷ (Divide)',
      duration: '3:53',
      durationSec: 233,
      ytId: 'JGwWNGJdvx8',
      audioId: 'JGwWNGJdvx8',
      musicVideoId: 'JGwWNGJdvx8',
      cover: 'https://yt3.googleusercontent.com/UpJ_IhBqyhQV9b2UGcDxxWDm14kRQ2eY1o9S96AGsbE7Ol8isbpbPA0Yefvg8S8ZGAX9L1g4xaj21zVJ=w800-h800-l90-rj',
      category: 'workout',
      plays: '6.2B plays'
    },
    {
      id: 'trk-14',
      title: 'Bad Guy',
      artist: 'Billie Eilish',
      album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?',
      duration: '3:14',
      durationSec: 194,
      ytId: 'DyDFGwXt208',
      audioId: 'DyDFGwXt208',
      musicVideoId: 'DyDFGwXt208',
      cover: 'https://yt3.googleusercontent.com/_72AYxGc5r6U2SwbDvo8qLTx0wLp1bxRAQTSWNZfeZOdP2zf6yHjIAzTZCFILrbz3AvxHqHJdqde56Y=w800-h800-l90-rj',
      category: 'energize',
      plays: '2.4B plays'
    },
    {
      id: 'trk-15',
      title: 'Industry Baby',
      artist: 'Lil Nas X & Jack Harlow',
      album: 'MONTERO',
      duration: '3:32',
      durationSec: 212,
      ytId: 'UTHLKHL_whs',
      audioId: 'UTHLKHL_whs',
      musicVideoId: 'UTHLKHL_whs',
      cover: 'https://yt3.googleusercontent.com/umJNTu_qH_THEHP4XsOb4bMCjKn1nka4c8iz8Vs791pB5aroCWwq4aHC9ds5kCnONrgNUPgPadWnecak=w800-h800-l90-rj',
      category: 'workout',
      plays: '2.0B plays'
    },
    {
      id: 'trk-16',
      title: 'Cruel Summer',
      artist: 'Taylor Swift',
      album: 'Lover',
      duration: '2:58',
      durationSec: 178,
      ytId: 'ic8j13piAhQ',
      audioId: 'ic8j13piAhQ',
      musicVideoId: 'ic8j13piAhQ',
      cover: 'https://yt3.googleusercontent.com/R_cjQK3wwLPEzri1jerx-79zgzGocoKvwGU3NMONaTsaMM0Idd641pfB8r5jgfpn6I8JAoFtf9RBIcI=w800-h800-l90-rj',
      category: 'party',
      plays: '2.2B plays'
    },
    {
      id: 'trk-17',
      title: 'Water',
      artist: 'Tyla',
      album: 'TYLA',
      duration: '3:20',
      durationSec: 200,
      ytId: 'XoiOOiuH8iI',
      audioId: 'XoiOOiuH8iI',
      musicVideoId: 'XoiOOiuH8iI',
      cover: 'https://yt3.googleusercontent.com/w9WrUTZckeY-PCYJsytiVyw5tVCtFsirBtnYGRvSIby3oRjYXHaszrbJsyfmZ6mdbE2UB-c7iqjJdR0=w800-h800-l90-rj',
      category: 'relax',
      plays: '890M plays'
    },
    {
      id: 'trk-18',
      title: 'Counting Stars',
      artist: 'OneRepublic',
      album: 'Native',
      duration: '4:17',
      durationSec: 257,
      ytId: 'hT_nvWreIhg',
      audioId: 'hT_nvWreIhg',
      musicVideoId: 'hT_nvWreIhg',
      cover: 'https://yt3.googleusercontent.com/IBwK4LOs4sO-Cd-_5YO4XC2B2N1hvyBvKfr60tT_ljIuwmOuVWWW2NypbcvzKgScVAbRsWEYbmsjfcm2cw=w800-h800-l90-rj',
      category: 'commute',
      plays: '4.0B plays'
    },
    {
      id: 'trk-19',
      title: 'Believer',
      artist: 'Imagine Dragons',
      album: 'Evolve',
      duration: '3:24',
      durationSec: 204,
      ytId: '7wtfhZwyrcc',
      audioId: '7wtfhZwyrcc',
      musicVideoId: '7wtfhZwyrcc',
      cover: 'https://yt3.googleusercontent.com/FtKxpe4wQSomNk3HGvUMyqHTyy6h56Oey4dJhPJeioRIMCvXVj1pRCHo1zBCTYYoRXQEVgNDfhB1Hg2O=w800-h800-l90-rj',
      category: 'workout',
      plays: '2.8B plays'
    },
    {
      id: 'trk-20',
      title: 'Wake Me Up',
      artist: 'Avicii',
      album: 'True',
      duration: '4:07',
      durationSec: 247,
      ytId: 'IcrbM1l_BoI',
      audioId: 'IcrbM1l_BoI',
      musicVideoId: 'IcrbM1l_BoI',
      cover: 'https://yt3.googleusercontent.com/JDKz3Anlyo49xBhFcFx13QD_Tk4-kqdiYTo15gtkL93nE8biWyZ7o0BPyW6RnXVxcXaJ5DgU5nJ_0NjJ=w800-h800-l90-rj',
      category: 'energize',
      plays: '2.5B plays'
    }
  ],

  playlists: [
    {
      id: 'pl-1',
      title: "Today's Biggest Hits",
      subtitle: 'The Weeknd, Dua Lipa, Harry Styles and more',
      cover: 'https://yt3.googleusercontent.com/R_cjQK3wwLPEzri1jerx-79zgzGocoKvwGU3NMONaTsaMM0Idd641pfB8r5jgfpn6I8JAoFtf9RBIcI=w800-h800-l90-rj',
      trackIds: ['trk-1', 'trk-4', 'trk-5', 'trk-6', 'trk-10']
    },
    {
      id: 'pl-2',
      title: 'Synthwave & Deep Focus',
      subtitle: 'Atmospheric electronic & night drive essentials',
      cover: 'https://yt3.googleusercontent.com/FtKxpe4wQSomNk3HGvUMyqHTyy6h56Oey4dJhPJeioRIMCvXVj1pRCHo1zBCTYYoRXQEVgNDfhB1Hg2O=w800-h800-l90-rj',
      trackIds: ['trk-9', 'trk-1', 'trk-2', 'trk-7']
    },
    {
      id: 'pl-3',
      title: 'Chill Hop & Night Vibes',
      subtitle: 'Mellow beats, smooth melodies, zero stress',
      cover: 'https://yt3.googleusercontent.com/w9WrUTZckeY-PCYJsytiVyw5tVCtFsirBtnYGRvSIby3oRjYXHaszrbJsyfmZ6mdbE2UB-c7iqjJdR0=w800-h800-l90-rj',
      trackIds: ['trk-7', 'trk-8', 'trk-3', 'trk-6']
    },
    {
      id: 'pl-4',
      title: 'Pure Cardio Workout',
      subtitle: 'High energy bangers to push your limits',
      cover: 'https://yt3.googleusercontent.com/dcxXIIlest09vnvKznWM9VWQXu1EL7lKxBzXGzwgmVjmMNBm1dEWT_0qn1xrEZYyKF_qRE1TLq8P_JY_mQ=w800-h800-l90-rj',
      trackIds: ['trk-2', 'trk-5', 'trk-9', 'trk-10', 'trk-4']
    }
  ],

  genres: [
    { name: 'Pop', color: 'from-pink-600 to-rose-900', icon: 'sparkles' },
    { name: 'Hip-Hop & R&B', color: 'from-amber-600 to-orange-900', icon: 'disc' },
    { name: 'Electronic & Dance', color: 'from-cyan-600 to-blue-900', icon: 'zap' },
    { name: 'Indie & Alternative', color: 'from-emerald-600 to-teal-900', icon: 'compass' },
    { name: 'Rock & Metal', color: 'from-red-600 to-stone-900', icon: 'flame' },
    { name: 'Chill & Ambient', color: 'from-indigo-600 to-purple-900', icon: 'moon' }
  ]
};

// Export on window for global access across modules
window.YTM_DATA = YTM_DATA;
