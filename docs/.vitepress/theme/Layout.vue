<script setup>
import { useData, withBase, useRoute } from 'vitepress'

const { site, theme, page, frontmatter } = useData()
const route = useRoute()
</script>

<template>
  <div class="max-w-screen-md mx-auto px-4">
    <div id="site-header" class="flex items-center justify-between py-4 border-b mb-4">
      <a :href="withBase('/')" id="site-logo" class="flex items-center">
        <img :src="withBase('/favicon.png')" alt="">
        <span class="ml-4 font-semibold text-lg">{{ site.title }}</span>
      </a>
      <div class="flex text-sm gap-2">
        <a v-for="item in theme.socialLinks"
          class="text-white px-1" :style="{ background: item.color }"
          :href="item.link">{{ item.text }}</a>
      </div>
    </div>
    <!-- On a phone the page comes first and the page list follows it -->
    <div class="flex flex-col-reverse md:flex-row mb-4 items-start">
      <nav class="w-full md:w-1/4 mt-8 md:mt-0 border shadow-sm rounded p-2 text-sm flex flex-col flex-shrink-0">
        <template v-for="group, i in theme.sidebar">
          <span v-if="group.text"
            class="px-2 pt-1 pb-px text-xs font-semibold uppercase text-gray-500">{{ group.text }}</span>
          <template v-for="item in group.items">
            <a v-if="route.path === withBase(`${item.link}.html`)"
              class="px-2 py-1 rounded m-px bg-gray-800 text-white"
              :href="withBase(item.link)">{{ item.text }}</a>
            <a v-else
              class="px-2 py-1 rounded m-px hover:bg-gray-200"
              :href="withBase(item.link)">{{ item.text }}</a>
          </template>
          <hr v-if="i < theme.sidebar.length - 1"
            class="my-1 mx-2">
        </template>
      </nav>
      <article class="min-w-0 w-full md:w-3/4 md:ml-8 markdown-body">
        <h1 v-if="page.relativePath !== 'index.md' && frontmatter.title"
          class="text-3xl">{{ frontmatter.title }}</h1>
        <Content />
      </article>
    </div>
  </div>
</template>

<style lang="postcss">
@import url('./style.css');
@tailwind base;
@tailwind utilities;

#site-logo img {
  width: 52px;
}
</style>
