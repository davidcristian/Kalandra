import logging
import os
import shutil
import subprocess  # nosec B404 # runs only the export command, found on the PATH

logger = logging.getLogger(__name__)

EXPORT_COMMAND = "pathofexile-dat"


class GameDataProvider:
    def __init__(self):
        self.vendor_dir: str = os.path.join(
            os.path.dirname(__file__), "../../data/vendor"
        )

    def run_export(self):
        # shutil.which also finds a .cmd file on Windows, so the command runs without a shell
        command = shutil.which(EXPORT_COMMAND)
        if command is None:
            logger.error(
                f"Game data export failed: {EXPORT_COMMAND} is not on the PATH"
            )
            return
        try:
            _ = subprocess.run([command], cwd=self.vendor_dir, check=True)  # nosec B603 # a fixed command, no arguments
            logger.info(f"Exported game data to: {self.vendor_dir}")
        except (subprocess.CalledProcessError, OSError) as e:
            logger.error(f"Game data export failed: {e}")
