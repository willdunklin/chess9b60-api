import { nanoid } from 'nanoid';

export function getNewID() {
    const str = nanoid().replace(/[^a-zA-Z0-9]/g, 'w');
    return str.substring(0, 6);
}
