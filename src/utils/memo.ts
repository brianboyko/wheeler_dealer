export const memo = (fn: Function) => {
  const cache: Record<string, any> = {};
  return (...args: any[]) => {
    const key = JSON.stringify(args);
    if (!cache[key]) {
      cache[key] = fn(...args);
    }
    return cache[key];
  };
};

export default memo;
