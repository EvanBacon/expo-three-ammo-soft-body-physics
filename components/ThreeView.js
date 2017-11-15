import Expo from 'expo';
import React from 'react';
import { findNodeHandle, Platform, NativeModules, View, Text, StyleSheet } from 'react-native';
import PropTypes from 'prop-types'; // 15.6.0
const ErrorMessage = {
  simulator: `Can't Run GLView in Simulator :(`,
  aNine: `ARKit can only run on iOS devices with A9 (2015) or greater chips! This is a`,
  notIosAR: `ARKit can only run on an iOS device! This is a`,
};

export default class ThreeView extends React.Component {
  static propTypes = {
    style: View.propTypes.style,
    onContextCreate: PropTypes.func.isRequired,
    render: PropTypes.func.isRequired,
    enableAR: PropTypes.bool,
  };

  _renderErrorView = error => (
    <View style={styles.errorContainer}>
      <Text>{error}</Text>
    </View>
  );
  render = () => {
    return (
      <Expo.GLView
        nativeRef_EXPERIMENTAL={this._setNativeGLView}
        style={styles.container}
        onContextCreate={this._onGLContextCreate}
      />
    );
  };

  _setNativeGLView = ref => {
    this._nativeGLView = ref;
  };

  _onGLContextCreate = async gl => {
    // Stubbed out methods for shadow rendering
    gl.createRenderbuffer = () => {};
    gl.bindRenderbuffer = () => {};
    gl.renderbufferStorage = () => {};
    gl.framebufferRenderbuffer = () => {};

    let arSession;
    if (this.props.enableAR) {
      // Start AR session
      arSession = await NativeModules.ExponentGLViewManager.startARSessionAsync(
        findNodeHandle(this._nativeGLView)
      );
    }

    await this.props.onContextCreate(gl, arSession);
    let lastFrameTime;
    const render = () => {
      const now = 0.001 * global.nativePerformanceNow();
      const dt = typeof lastFrameTime !== 'undefined' ? now - lastFrameTime : 0.16666;
      requestAnimationFrame(render);

      this.props.render(dt);
      // NOTE: At the end of each frame, notify `Expo.GLView` with the below
      gl.endFrameEXP();

      lastFrameTime = now;
    };
    render();
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: 'orange',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
