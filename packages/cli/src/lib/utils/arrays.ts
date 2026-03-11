export const groupBy = <T, K>(
    list: T[],
    keySelector: (item: T) => K,
): Map<K, T[]> => {
    return list.reduce((map, item) => {
        const key = keySelector(item);
        if (!map.has(key)) {
            map.set(key, []);
        }
        map.get(key)!.push(item);
        return map;
    }, new Map<K, T[]>());
};
