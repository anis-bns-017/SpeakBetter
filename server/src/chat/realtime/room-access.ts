/**
 * Every socket of a user joins this room on connect, so an event for "all of
 * someone's tabs and devices" reaches them on any server instance.
 */
export const userRoom = (userId: string) => `user:${userId}`;
