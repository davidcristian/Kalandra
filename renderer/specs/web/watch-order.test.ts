import { describe, expect, it } from "vitest";
import { createRenderer, defineComponent, nextTick, ref, watch } from "vue";

// CheckedItem.vue builds the filters of a new item in one watcher and searches with them in the
// next one. Vue 3.2.38 to 3.3.6 ran such watchers out of order: github.com/vuejs/core/issues/7576
interface FakeNode {
  children: FakeNode[];
  parent: FakeNode | null;
}

function fakeNode(): FakeNode {
  return { children: [], parent: null };
}

const { createApp } = createRenderer<FakeNode, FakeNode>({
  createElement: fakeNode,
  createText: fakeNode,
  createComment: fakeNode,
  insert(node, parent) {
    node.parent = parent;
    parent.children.push(node);
  },
  remove(node) {
    node.parent?.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = null;
  },
  setText: () => undefined,
  setElementText: () => undefined,
  parentNode: (node) => node.parent,
  nextSibling(node) {
    const siblings = node.parent?.children ?? [];
    return siblings[siblings.indexOf(node) + 1] ?? null;
  },
  patchProp: () => undefined,
});

describe("Vue watchers", () => {
  it("run in the order one component defines them", async () => {
    const source = ref(0);
    const order: string[] = [];
    const Watchers = defineComponent({
      setup() {
        for (const name of ["first", "second", "third", "fourth"]) {
          watch(source, () => order.push(name));
        }
        return () => null;
      },
    });
    createApp(Watchers).mount(fakeNode());

    source.value++;
    await nextTick();

    expect(order).toEqual(["first", "second", "third", "fourth"]);
  });
});
