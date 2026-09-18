import fs from "fs";
import path from "path";
import { transformFileAsync } from "@babel/core";
import { rollup } from "rollup";
import JSZip from "jszip";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export async function removeRequires(file: string): Promise<boolean> {
    const bundle = await rollup({
        input: file,
        plugins: [
            nodeResolve({
                browser: true
            }),
            commonjs()
        ]
    });

    try {
        await bundle.write({
            format: "iife",
            file
        });
        return true;
    } finally {
        await bundle.close();
    }
}

export async function transpileFile(file: string): Promise<void> {
    try {
        const result = await transformFileAsync(file, {
            presets: [
                [
                    "@babel/preset-env", {
                        corejs: {
                            version: 3
                        },
                        useBuiltIns: "usage",
                        targets: {
                            ie: "11"
                        }
                    }
                ]
            ]
        });

        if (!result) {
            console.error(`Error transpiling ${file}`);
            return;
        }

        fs.writeFileSync(file, result.code ?? "");
        await removeRequires(file);

        console.log(`Transpiled ${file}`);
    } catch (err) {
        console.debug(`Failed to transpile ${file}`, err);
    }
}

export async function transpileDir(dir: string): Promise<void> {
    const files = fs.readdirSync(dir);

    await Promise.all(files.map(async (file: string) => {
        const fileWithDir = path.resolve(dir, file);

        if (fs.statSync(fileWithDir).isDirectory()) {
            await transpileDir(fileWithDir);
            return;
        }

        switch (path.extname(fileWithDir)) {
            case ".js":
                await transpileFile(fileWithDir);
                break;
            case ".zip":
                // Zip extraction is not implemented yet.
                // The archive should be extracted without overwriting existing files.
                new JSZip();
                break;
            default:
                break;
        }
    }));
}

export default async function transpileAll(): Promise<void[]> {
    return Promise.all([
        "data",
        "dl",
        "system"
    ].map((dir: string) => transpileDir(dir)));
}

if (require.main === module) transpileFile("fak.js");
