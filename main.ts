#!/usr/bin/env node
import * as fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises"
import child_process from "node:child_process";
import util from "node:util";

const execFile = util.promisify(child_process.execFile);

type RepositoryType = "Remote" | "LocalBare" | "LocalNonBare"

interface RepositoryRoot {
    name: string;
    basePath: string;
    type: RepositoryType;
}

interface Settings {
    repositoryRoots: RepositoryRoot[];
}

class App {
    rl: readline.Interface;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }

    start() {
        this.main().catch(reason => {
            console.error(reason);
            process.exit(1);
        }).finally(() => {
            this.rl.close();
        })
    }

    private async main() {
        const repoName = await this.getRepoName();
        console.log("Repository name: " + repoName);
        console.log();
        const repoRoots = await this.getRepoRoots();
        console.log();
        console.log("Repositories to be added as the remote origin:");
        for (const repoRoot of repoRoots) {
            console.log(`- ${repoRoot.name}(${repoRoot.type}): ${repoRoot.basePath}/${repoName}`);
        }
        console.log();
        const whetherAdd = await this.askYesOrNo("Do you want to add these repositories as the remote origin?");
        
        if (!whetherAdd) return;

        await this.execFileWithLogs("git", ["remote", "add", "origin", `${repoRoots[0].basePath}/${repoName}`]);
        for (const repoRoot of repoRoots) {
            await this.execFileWithLogs("git", ["remote", "set-url", "--add", "--push", "origin", `${repoRoot.basePath}/${repoName}`]);
        }
    }

    async execFileWithLogs(file: string, args: string[]): Promise<void> {
        console.log(`Executing... file: ${file}, args: ${args}`);
        await execFile(file, args);
    }

    async askYesOrNo(msg: string): Promise<boolean> {
        while(true) {
            const ans = await this.rl.question(msg + " (y/n): ");
            if (ans === "y") return true;
            else if (ans === "n") return false;
            console.error("Type 'y' or 'n'");
        }
    }

    async getRepoRoots(): Promise<RepositoryRoot[]> {
        const settings = await this.loadSettings();
        console.log("Registered repositories:");
        settings.repositoryRoots.forEach((v, idx) => {
            console.log(`[${idx}] ${v.name}`);
        })
        console.log();

        let indexes: number[] = [];
        while (true) {
            const ans = await this.rl.question("Enter indexes of repositories you want to use.\n" +
                "The first choice will be used as the fetch repository. (Comma separated): ");
            indexes = ans.split(",")
                .map((value, _) => value.trim())
                .map((value, _) => Number.parseInt(value));
            if (indexes.find((value, _) => Number.isNaN(value)) === undefined) {
                break;
            }
            console.error("Enter numbers");
        }

        return indexes.map((val, _) => {
            return settings.repositoryRoots[val];
        });
    }

    async getRepoName(): Promise<string> {
        let repoName = path.basename(process.cwd()) + ".git";
        let ans = await this.rl.question(`Enter the name of the repository [${repoName}]: `);
        return ans === ""
            ? repoName
            : ans;
    }

    async loadSettings(): Promise<Settings> {
        const homePath = process.platform === "win32"
            ? process.env["USERPROFILE"]
            : process.env["HOME"];
        if (homePath === undefined) {
            throw "Could not retrieve HOME environment variable";
        }
        const configPath = path.join(homePath, ".git-remote-manager.json");
        return JSON.parse((await fs.readFile(configPath)).toString());
    }
}

new App().start();
