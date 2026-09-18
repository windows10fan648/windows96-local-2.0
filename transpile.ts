import { writeFile, readdir, stat } from "fs/promises";
import path from "path";
import { transformFileAsync } from "@babel/core";
import { rollup } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export async function removeRequires(file: string): Promise<boolean> {
    const bundle = await rollup({
        input: file,
        plugins: [
            nodeResolve({ browser: true }),
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
            throw new Error(`Babel returned no result for ${file}`);
        }

        await writeFile(file, result.code ?? "");
        await removeRequires(file);

        console.log(`Transpiled ${file}`);
    } catch (err: unknown) {
        console.error(`Failed to transpile ${file}`, err);
        throw err;
    }
}

export async function transpileDir(dir: string): Promise<void> {
    const files = await readdir(dir);

    await Promise.all(files.map(async (file: string) => {
        const fileWithDir = path.resolve(dir, file);
        const fileStats = await stat(fileWithDir);

        if (fileStats.isDirectory()) {
            await transpileDir(fileWithDir);
            return;
        }

        if (path.extname(fileWithDir) === ".js") {
            await transpileFile(fileWithDir);
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

if (require.main === module) {
    transpileFile("fak.js")
        .catch(() => {
            process.exitCode = 1;
        });
}
