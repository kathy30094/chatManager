<template>
  <div id="app">
    <!-- <img src="./assets/logo.png"> -->
    <router-view/><!--  --><!--  --><!--  --><!--  -->
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>


<style>
  html, body {
      padding: 0;
      margin: 0;
      background-attachment: fixed;
      background-repeat: no-repeat;
      background-size: 100% 100%;
  }

  #container {
      margin: 0 auto;
      display: block;
      position: relative;
  }

  #status-box {
      text-align: right;
      font-size: .6em;
      padding-top: 9%;
  }

    
</style>
