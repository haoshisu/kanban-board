type LocalReplicaWrite = () => Promise<void>;

const writeQueues = new Map<string, Promise<void>>();

export const enqueueLocalReplicaWrite = (
 resourceKey: string,
 write: LocalReplicaWrite,
): Promise<void> => {
 const previousWrite = writeQueues.get(resourceKey) ?? Promise.resolve();
 const nextWrite = previousWrite.catch(() => undefined).then(write);

 writeQueues.set(resourceKey, nextWrite);

 void nextWrite
  .finally(() => {
   if (writeQueues.get(resourceKey) === nextWrite) {
    writeQueues.delete(resourceKey);
   }
  })
  .catch(() => undefined);

 return nextWrite;
};

export const flushLocalReplicaWrites = async () => {
 while (writeQueues.size > 0) {
  await Promise.allSettled([...writeQueues.values()]);
 }
};
