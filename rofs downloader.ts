import { DownloaderHelper } from "node-downloader-helper";
import { readFile, rm, mkdir } from "fs/promises";
import path from "path";
import { RofsJson, fileType } from "./fsbuilder";

export async function downloadRofsFile(
    outDir = __dirname,
    w96Domain = "https://windows96.net",
    rofsLocation = "/system/images/rofs.json"
): Promise<boolean> {
    const rofsPath = path.resolve(outDir, "rofs.json");

    try {
        await rm(rofsPath, { force: true });
    } catch (err: unknown) {
        console.error(`Failed to remove existing ${rofsPath}`, err);
        return false;
    }

    return downloadFile(`${w96Domain}${rofsLocation}`, outDir);
}

export async function downloadFile(file: string, outDir = __dirname): Promise<boolean> {
    return new Promise((resolve) => {
        const downloader = new DownloaderHelper(file, outDir);

        downloader.on("end", () => {
            console.log(`Download of file ${file} completed`);
            resolve(true);
        });

        downloader.on("error", (err: unknown) => {
            console.error(`Download of file ${file} failed`, err);
            resolve(false);
        });

        downloader.start().catch((err: unknown) => {
            console.error(`Download of file ${file} failed`, err);
            resolve(false);
        });
    });
}

export async function readRofs(rofsFile = "./rofs.json"): Promise<RofsJson> {
    const rofs = JSON.parse(await readFile(rofsFile, "utf8")) as RofsJson;

    rofs["/system/images"] = { length: 0, type: fileType.directory };
    rofs["/system/images/rootfs"] = { length: 0, type: fileType.directory };

    [
        "rofs.json",
        "mobsupport-ios.zip",
        "mobsupport-generic.zip",
        "mobsupport.zip",
        "bstr.json",
        "recovery.zip",
        "rootfs.zip",
        "rootfs/recovery.zip",
        "rootfs/oobe.zip",
        "rootfs/rootfs.zip"
    ].forEach((file: string) => {
        rofs[`/system/images/${file}`] = { length: 0, type: fileType.file };
    });

    rofs["/vc"] = { length: 0, type: fileType.directory };
    rofs["/vc/ct.js"] = { length: 0, type: fileType.file };

    return rofs;
}

export async function createDirectories(rofs: RofsJson, outDir = __dirname): Promise<void> {
    await Promise.all(Object.entries(rofs)
        .filter(([, entry]) => entry.type === fileType.directory)
        .map(([fileOrDir]) => mkdir(path.join(outDir, fileOrDir), { recursive: true })));
}

export async function downloadFiles(
    rofs: RofsJson,
    outDir = __dirname,
    w96Domain = "https://windows96.net"
): Promise<void> {
    for (const [fileOrDir, entry] of Object.entries(rofs)) {
        if (entry.type !== fileType.file) continue;

        const url = `${w96Domain}${fileOrDir}`;
        const fileDir = path.join(outDir, path.dirname(fileOrDir));
        const success = await downloadFile(url, fileDir);

        if (!success) throw new Error(`Failed to download ${url}`);
    }
}

export async function downloadRofsContents(
    outDir = __dirname,
    w96Domain = "https://windows96.net",
    rofsFile = "./rofs.json"
): Promise<void> {
    const rofs = await readRofs(rofsFile);

    await createDirectories(rofs, outDir);
    await downloadFiles(rofs, outDir, w96Domain);
}

export default async function initiateDownload(
    outDir = __dirname,
    w96Domain = "https://windows96.net"
): Promise<void> {
    const success = await downloadRofsFile(outDir, w96Domain);

    if (!success) throw new Error("Failed to download rofs.json");

    console.log("rofs.json downloaded successfully");
    await downloadRofsContents(outDir, w96Domain);
}

if (require.main === module) {
    initiateDownload(__dirname, process.argv[2])
        .then(() => console.log("Done"))
        .catch((err: unknown) => {
            console.error(err);
            process.exitCode = 1;
        });
}
