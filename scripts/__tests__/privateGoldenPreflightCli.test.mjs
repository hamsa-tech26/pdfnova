import {describe,it,expect} from "vitest";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";

const cli=fileURLToPath(new URL("../privateGoldenPreflight.mjs",import.meta.url));

describe("Task 205 fail-closed private intake status",()=>{
  it("distinguishes an absent corpus from a present-but-invalid corpus",async()=>{
    const cwd=await mkdtemp(path.join(tmpdir(),"kuku-private-intake-test-"));
    try{
      const run=(args=[])=>{
        const processResult=spawnSync(process.execPath,[cli,...args],{
          cwd,encoding:"utf8",timeout:20000});
        expect(processResult.signal).toBeNull();
        return {code:processResult.status,summary:JSON.parse(processResult.stdout)};
      };
      const noData=run();
      expect(noData.code).toBe(0);
      expect(noData.summary.status).toBe("NOT_RUN");
      expect(noData.summary.realWorldAccuracy).toBe("NOT_MEASURED");
      expect(run(["--require-ready"]).code).toBe(2);

      await mkdir(path.join(cwd,"benchmarks/golden/private"),{recursive:true});
      const incomplete=run();
      expect(incomplete.code).toBe(2);
      expect(incomplete.summary.status).toBe("BLOCKED_INTAKE");
      expect(incomplete.summary.reasonCode).toBe("INVALID_OR_INCOMPLETE_PRIVATE_CORPUS");
      expect(incomplete.summary.realWorldAccuracy).toBe("NOT_MEASURED");
    }finally{await rm(cwd,{recursive:true,force:true});}
  });
});
