<template>
  <transition
    enter-active-class="animate__animated animate__fadeIn"
    leave-active-class="animate__animated animate__backOutDown"
  >
    <div :class="$style.widget" v-if="show">
      <div :class="$style.box">
        <div class="py-2 px-4">
          <div class="text-base">Kalandra</div>
          <p>{{ t("app_is_ready") }}</p>
          <p v-if="notice" class="max-w-xl text-yellow-400">{{ notice }}</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import type { ConfigProblem } from "@ipc/config-problem";
import { Host } from "@/web/background/IPC";
import { AppConfig } from "@/web/Config";

const { t } = useI18n();

const show = shallowRef(false);
const notice = shallowRef<string | null>(null);
let noticeShown = false;

function configNotice(problem: ConfigProblem): string {
  if (problem.reason === "not-json") {
    return t("config_not_json", [problem.file, problem.backup]);
  }
  return t("config_unreadable", [problem.file, problem.message]);
}

Host.onEvent("MAIN->OVERLAY::overlay-attached", () => {
  if (show.value) return;
  const problem = noticeShown ? null : Host.configProblem.value;
  if (!problem && !AppConfig().showAttachNotification) return;
  notice.value = problem ? configNotice(problem) : null;
  noticeShown = true;
  show.value = true;
  // A path takes longer to read than the usual two words
  setTimeout(
    () => {
      show.value = false;
    },
    problem ? 20000 : 2500,
  );
});
</script>

<style lang="postcss" module>
.widget {
  position: absolute;
  display: flex;
  width: 100%;
  justify-content: center;
  bottom: 20%;
}

.box {
  position: relative;
  display: flex;
  @apply bg-gray-800;
  @apply text-gray-100;
  @apply rounded;
  box-shadow: 0px 0px 1px 2px rgb(255 255 255 / 20%);
}

.box::before {
  position: absolute;
  content: "";
  background: url("/images/jeweler.png") no-repeat top right/contain;
  right: 100%;
  width: 100%;
  height: 100%;
  max-width: 78px;
  @apply mr-2;
  pointer-events: none;
  filter: drop-shadow(2px 4px 6px #000);
}
</style>
