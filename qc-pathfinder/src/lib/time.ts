import { RouteResult, Stop, TimelineLeg, TimelineLegStatus } from './types';

/**
 * Parses "HH:mm" into total minutes from 00:00 (midnight).
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  return h * 60 + m;
}

/**
 * Formats total minutes from midnight into 24-hour "HH:mm".
 */
export function minutesToTimeString(totalMinutes: number): string {
  // Normalize within 24 hours
  let mins = Math.round(totalMinutes);
  while (mins < 0) mins += 24 * 60;
  mins = mins % (24 * 60);

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Formats "HH:mm" or minutes to 12-hour display string (e.g. "9:15 AM", "12:00 PM").
 */
export function format12Hour(time: string | number): string {
  const totalMins = typeof time === 'number' ? time : timeStringToMinutes(time);
  let mins = Math.round(totalMins);
  while (mins < 0) mins += 24 * 60;
  mins = mins % (24 * 60);

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Computes transition metrics and slack between two consecutive stops.
 */
export function computeLeg(
  fromStop: Stop,
  toStop: Stop,
  route: RouteResult | undefined,
  bufferMinutes: number = 2,
  sameBuilding: boolean = false
): TimelineLeg {
  const fromEndMins = timeStringToMinutes(fromStop.end);
  const toStartMins = timeStringToMinutes(toStop.start);

  const gapMinutes = toStartMins - fromEndMins;
  const walkMinutes = sameBuilding ? 0 : (route?.found ? Math.ceil(route.walkSeconds / 60) : 0);
  const slackMinutes = gapMinutes - walkMinutes - bufferMinutes;

  const leaveByMins = toStartMins - walkMinutes - bufferMinutes;
  const leaveByTime = minutesToTimeString(leaveByMins);

  let status: TimelineLegStatus = 'comfortable';
  let statusLabel = 'Comfortable';

  if (sameBuilding) {
    status = 'same-building';
    statusLabel = 'Same building';
  } else if (!route || !route.found) {
    status = 'no-route';
    statusLabel = 'No route found';
  } else if (slackMinutes < 0) {
    status = 'impossible';
    statusLabel = "Won't make it";
  } else if (slackMinutes < 3) {
    status = 'tight';
    statusLabel = 'Tight';
  } else {
    status = 'comfortable';
    statusLabel = 'Comfortable';
  }

  return {
    fromStop,
    toStop,
    sameBuilding,
    route,
    walkMinutes,
    gapMinutes,
    slackMinutes,
    leaveByTime,
    status,
    statusLabel,
  };
}

/**
 * Helper to produce human-friendly banner text for a leg:
 * e.g. "Walk 6 min • Leave by 10:52 • 4 min to spare"
 */
export function getLegDescription(leg: TimelineLeg): string {
  if (leg.sameBuilding) {
    return `Same building • ${leg.gapMinutes} min between classes`;
  }
  if (!leg.route || !leg.route.found) {
    return 'No route found between these locations';
  }
  if (leg.status === 'impossible') {
    const deficit = Math.abs(leg.slackMinutes);
    return `Walk ${leg.walkMinutes} min • Short by ${deficit} min • Won't make it`;
  }
  if (leg.status === 'tight') {
    return `Walk ${leg.walkMinutes} min • Leave by ${leg.leaveByTime} • ${leg.slackMinutes} min to spare (Tight)`;
  }
  return `Walk ${leg.walkMinutes} min • Leave by ${leg.leaveByTime} • ${leg.slackMinutes} min to spare`;
}
