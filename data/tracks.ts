import {LatLng} from "../helpers/generatePerpendicularSectors";

export interface TrackSector {
    id: string;
    center: LatLng;    // point on center line of track at this sector
    trackP1: LatLng;   // first point defining direction (preceding or following along track)
    trackP2: LatLng;   // second point defining direction (following or preceding along track)
    halfWidth?: number; // half-width of timing line in meters (default: 12m)
}

// Centralized track definitions with map region + start/end centers
export interface Track {
    id: string;
    name: string;
    location: string;
    flag: any; // image require reference
    latitude: number; // map center latitude
    longitude: number; // map center longitude
    latitudeDelta: number;
    longitudeDelta: number;
    sectors: TrackSector[]; // ordered list of timing sectors
    startLine: TrackSector; // explicit start timing line definition
    finishLine?: TrackSector; // optional finish; if omitted, start==finish
}

// NOTE: All sector coordinates are placeholders; replace with precise GPS track geometry.
export const TRACKS: Track[] = [
    {
        id: 'libo',
        name: 'Libomysl',
        location: 'Libomysl, Czech Republic',
        flag: require('../assets/flags/cz.png'),
        latitude: 49.871085,
        longitude: 13.997966,
        latitudeDelta: 0.002,
        longitudeDelta: 0.002,
        // sectors now only includes intermediate boundaries (may be empty). Libomysl has one internal sector 'mid'.
        sectors: [
            {
                id: 'sector1',
                center: {latitude: 49.87146565704214, longitude: 13.99814602374828},
                trackP1: {latitude: 49.87143012744712, longitude: 13.99827037995065},
                trackP2: {latitude: 49.871467349193715, longitude: 13.998049388539968},
                halfWidth: 6
            },
            {
                id: 'sector2',
                center: {latitude: 49.8710902548172, longitude: 13.997766810467205},
                trackP1: {latitude: 49.870998, longitude: 13.997746},
                trackP2: {latitude: 49.870938, longitude: 13.997721},
                halfWidth: 15
            },
        ],
        startLine: {
            id: 'start',
            center: {latitude: 49.87118968229144, longitude: 13.998301148495568},
            trackP1: {latitude: 49.87108722419816, longitude: 13.998293456359338},
            trackP2: {latitude: 49.871223559516416, longitude: 13.998340891199417}
        },
        // finishLine omitted => identical to startLine
    },
    {
        id: 'most',
        name: 'Autodrom Most',
        location: 'Most, Czech Republic',
        flag: require('../assets/flags/cz.png'),
        latitude: 50.5026,
        longitude: 13.6326,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
        sectors: [
            {
                id: 'sector2',
                center: {latitude: 50.502950, longitude: 13.632650},
                trackP1: {latitude: 50.502900, longitude: 13.632500},
                trackP2: {latitude: 50.503000, longitude: 13.632780}
            },
        ],
        startLine: {
            id: 'start',
            center: {latitude: 50.502800, longitude: 13.632400},
            trackP1: {latitude: 50.502750, longitude: 13.632250},
            trackP2: {latitude: 50.502850, longitude: 13.632550}
        },
        finishLine: {
            id: 'finish',
            center: {latitude: 50.502700, longitude: 13.632800},
            trackP1: {latitude: 50.502650, longitude: 13.632650},
            trackP2: {latitude: 50.502750, longitude: 13.632930}
        },
    },
    {
        id: 'brno',
        name: 'Brno Circuit',
        location: 'Brno, Czech Republic',
        flag: require('../assets/flags/cz.png'),
        latitude: 49.2039,
        longitude: 16.4576,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        sectors: [
            {
                id: 'sector2',
                center: {latitude: 49.204200, longitude: 16.457600},
                trackP1: {latitude: 49.204150, longitude: 16.457450},
                trackP2: {latitude: 49.204250, longitude: 16.457750}
            },
        ],
        startLine: {
            id: 'start',
            center: {latitude: 49.204100, longitude: 16.457400},
            trackP1: {latitude: 49.204050, longitude: 16.457250},
            trackP2: {latitude: 49.204150, longitude: 16.457550}
        },
        finishLine: {
            id: 'finish',
            center: {latitude: 49.204000, longitude: 16.457800},
            trackP1: {latitude: 49.203950, longitude: 16.457650},
            trackP2: {latitude: 49.204050, longitude: 16.457950}
        },
    },
    {
        id: 'slovakia',
        name: 'Slovakia Ring',
        location: 'Orechová Potôň, Slovakia',
        flag: require('../assets/flags/sk.png'),
        latitude: 48.0593,
        longitude: 17.5541,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        sectors: [
            {
                id: 'sector2',
                center: {latitude: 48.059350, longitude: 17.554150},
                trackP1: {latitude: 48.059300, longitude: 17.554000},
                trackP2: {latitude: 48.059400, longitude: 17.554300}
            },
        ],
        startLine: {
            id: 'start',
            center: {latitude: 48.059500, longitude: 17.553900},
            trackP1: {latitude: 48.059450, longitude: 17.553750},
            trackP2: {latitude: 48.059550, longitude: 17.554050}
        },
        finishLine: {
            id: 'finish',
            center: {latitude: 48.059400, longitude: 17.554300},
            trackP1: {latitude: 48.059350, longitude: 17.554150},
            trackP2: {latitude: 48.059450, longitude: 17.554450}
        },
    },
    {
        id: 'mugello',
        name: 'Mugello Circuit',
        location: 'Scarperia e San Piero, Italy',
        flag: require('../assets/flags/it.png'),
        latitude: 43.9917,
        longitude: 11.3719,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        sectors: [
            {
                id: 'sector2',
                center: {latitude: 43.991800, longitude: 11.371900},
                trackP1: {latitude: 43.991750, longitude: 11.371750},
                trackP2: {latitude: 43.991850, longitude: 11.372050}
            },
        ],
        startLine: {
            id: 'start',
            center: {latitude: 43.991900, longitude: 11.371700},
            trackP1: {latitude: 43.991850, longitude: 11.371550},
            trackP2: {latitude: 43.991950, longitude: 11.371850}
        },
        finishLine: {
            id: 'finish',
            center: {latitude: 43.991800, longitude: 11.372100},
            trackP1: {latitude: 43.991750, longitude: 11.371950},
            trackP2: {latitude: 43.991850, longitude: 11.372250}
        },
    },
    {
        id: 'barcelona',
        name: 'Circuit de Barcelona-Catalunya',
        location: 'Montmeló, Spain',
        flag: require('../assets/flags/es.png'),
        latitude: 41.57,
        longitude: 2.261,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
        sectors: [
            {
                id: 'sector2',
                center: {latitude: 41.570100, longitude: 2.261000},
                trackP1: {latitude: 41.570050, longitude: 2.260850},
                trackP2: {latitude: 41.570150, longitude: 2.261150}
            },
        ],
        startLine: {
            id: 'start',
            center: {latitude: 41.570200, longitude: 2.260800},
            trackP1: {latitude: 41.570150, longitude: 2.260650},
            trackP2: {latitude: 41.570250, longitude: 2.260950}
        },
        finishLine: {
            id: 'finish',
            center: {latitude: 41.570100, longitude: 2.261200},
            trackP1: {latitude: 41.570050, longitude: 2.261050},
            trackP2: {latitude: 41.570150, longitude: 2.261350}
        },
    },
];
