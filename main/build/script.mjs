import childProcess from "child_process";
import esbuild from "esbuild";

const isDev = !process.argv.includes("--prod");

// Importing electron throws when its binary is missing, and only the dev runner starts Electron.
const electron = isDev ? (await import("electron")).default : null;

const electronRunner = (() => {
  let handle = null;
  return {
    restart() {
      console.info("Restarting Electron process.");

      if (handle) handle.kill();
      handle = childProcess.spawn(electron, ["."], {
        stdio: "inherit",
      });
    },
  };
})();

const mainContext = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: !isDev,
  platform: "node",
  external: ["electron", "uiohook-napi", "electron-overlay-window"],
  outfile: "dist/main.js",
  define: {
    "process.env.STATIC": isDev ? '"../build/icons"' : '"."',
    "process.env.VITE_DEV_SERVER_URL": isDev
      ? '"http://localhost:5173"'
      : "null",
  },
  plugins: isDev
    ? [
        {
          name: "electron-runner",
          setup(build) {
            build.onEnd((result) => {
              if (!result.errors.length) electronRunner.restart();
            });
          },
        },
      ]
    : [],
});

if (isDev) {
  await mainContext.watch();
} else {
  await mainContext.rebuild();
  mainContext.dispose();
}
