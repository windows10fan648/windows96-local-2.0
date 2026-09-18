import { readdir, stat, writeFile } from "fs/promises";
import path from "path";

export enum fileType {
    file = 0,
    directory = 1
}

export type RofsJson = Record<string, {
    length: number,
    type: fileType,
}>;

export async function processDir(dir: string, rofs: RofsJson): Promise<void> {
    console.debug(`Processing ${dir}`);
    rofs[`/${dir}`] = {
        length: 0,
        type: fileType.directory
    };

    const dirListing = await readdir(dir);
    await Promise.all(dirListing.map(async (cFile: string) => {
        const fileWithDir = path.join(dir, cFile);
        const fileStats = await stat(fileWithDir);

        if (fileStats.isDirectory()) {
            await processDir(fileWithDir, rofs);
        } else {
            await processFile(fileWithDir, rofs, fileStats.size);
        }
    }));
}

export async function processFile(file: string, rofs: RofsJson, fileLength?: number): Promise<void> {
    console.debug(`Processing ${file}`);
    const length = fileLength ?? (await stat(file)).size;

    rofs[`/${file}`] = {
        length,
        type: fileType.file
    };
}

export async function build(rootDir: string): Promise<RofsJson> {
    const rofs: RofsJson = {
        "/": { length: 0, type: fileType.directory }
    };

    const normalizedRoot = path.normalize(rootDir);
    await processDir(normalizedRoot, rofs);

    if (rootDir === ".") delete rofs["/."];

    return rofs;
}

export default async function buildAndWrite(rootDir: string): Promise<void> {
    const rofs = await build(rootDir);

    console.debug(rofs);
    await writeFile(
        path.resolve(rootDir, "rofs.json"),
        JSON.stringify(rofs)
    );
}

if (require.main === module) {
    buildAndWrite(process.argv[2] ?? ".")
        .then(() => console.log("Done"))
        .catch((err: unknown) => {
            console.error(err);
            process.exitCode = 1;
        });
}
