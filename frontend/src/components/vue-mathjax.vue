<template>
  <span ref="mathContainer" class="vue-mathjax">{{ formula }}</span>
</template>

<script>
export default {
  name: "VueMathjax",
  props: {
    formula: {
      type: String,
      default: ""
    }
  },
  watch: {
    formula() {
      this.$nextTick(() => {
        this.renderMath();
      });
    }
  },
  mounted() {
    this.renderMath();
  },
  methods: {
    renderMath() {
      if (window.MathJax) {
        if (this.$refs.mathContainer) {
          window.MathJax.typesetPromise([this.$refs.mathContainer]).catch((err) => console.log(err.message));
        }
      } else {
        setTimeout(() => {
          this.renderMath();
        }, 200);
      }
    }
  }
}
</script>

<style scoped>
.vue-mathjax {
  display: inline-block;
}
</style>
