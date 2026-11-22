import Phaser from 'phaser';

/**
 * CRT / VHS presentation layer, applied to each scene's camera as a post effect.
 * Portrait art stays clean underneath; this only changes what is shown on screen.
 * `strength` (0-1) scales every part of the effect.
 */
const frag = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 uResolution;
uniform float uTime;
uniform float uStrength;
varying vec2 outTexCoord;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 curve(vec2 uv, float k) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(6.0, 5.0);
  uv = uv + uv * off * off * k;
  return uv * 0.5 + 0.5;
}

void main() {
  float s = uStrength;
  vec2 uv = curve(outTexCoord, s);

  // outside the curved glass: black
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // faint tracking wobble that drifts down the screen
  float band = smoothstep(0.0, 0.02, abs(fract(uTime * 0.05) - uv.y));
  uv.x += (1.0 - band) * 0.003 * s;

  // red / cyan edge separation and a little horizontal colour bleed
  float sep = 0.8 * s / uResolution.x;
  vec3 col;
  col.r = texture2D(uMainSampler, uv + vec2(sep, 0.0)).r;
  col.g = texture2D(uMainSampler, uv).g;
  col.b = texture2D(uMainSampler, uv - vec2(sep, 0.0)).b;
  vec3 bleed = texture2D(uMainSampler, uv - vec2(2.5 / uResolution.x, 0.0)).rgb;
  col = mix(col, max(col, bleed), 0.1 * s);

  // lifted blacks, slightly desaturated like worn tape
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(luma), 0.12 * s);
  col = col * (1.0 - 0.06 * s) + 0.035 * s;

  // scanlines: one dark line every 3 game pixels
  float line = 0.5 + 0.5 * cos(uv.y * uResolution.y * 2.0944);
  col *= 1.0 - 0.14 * s * line;

  // grain
  float n = rand(uv * uResolution + fract(uTime) * 100.0) - 0.5;
  col += n * 0.04 * s;

  // vignette / corner darkening
  vec2 v = uv * (1.0 - uv.yx);
  float vig = pow(clamp(v.x * v.y * 18.0, 0.0, 1.0), 0.28 * s);
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class CrtPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  static readonly KEY = 'CrtPipeline';
  strength = 0.6;

  constructor(game: Phaser.Game) {
    super({ game, name: CrtPipeline.KEY, fragShader: frag });
  }

  onPreRender() {
    this.set1f('uTime', this.game.loop.time / 1000);
    this.set1f('uStrength', this.strength);
    this.set2f('uResolution', this.renderer.width, this.renderer.height);
  }
}
