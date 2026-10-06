# Infinite Field / WebGPU Mandelbrot Explorer

A web-based Mandelbrot set explorer that can zoom rapidly far beyond the limits of ordinary floating-point arithmetic.

## Getting Started

Open `index.html` in a WebGPU-compatible browser. If opening it directly does not work, run the following command in this directory:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Then open `http://localhost:8000/` in your browser. On Windows, use `py` instead of `python` if `python` is not available. Make sure hardware acceleration is enabled.

WebGPU or Blob Workers may be restricted in embedded previews. If so, open the page in a normal browser tab.

[Demo](https://mtcedarnet.github.io/mandelbrot-deepzoom/)

## Controls

- Mouse wheel: Zoom in or out around the pointer position. Hold Shift for faster zooming.
- Drag: Pan the view. Double-click: Zoom in 4x. Touch input supports pinch zoom.
- `+` / `-`: Zoom 2x / 1/2x. `R`: Reset to the full view. `H`: Toggle the panel.
- `Space`: Start auto-zoom. `Esc`: Stop.
- Coordinates panel: Enter coordinates as decimal strings, and save or restore exact fixed-point coordinates as JSON.
- PNG: Save the current view as an image.

## Computation Method

Camera coordinates are represented using BigInt fixed-point values with 4096 fractional bits. The reference orbit is computed in a Web Worker, with precision increased according to the zoom level. On the GPU, perturbation calculations use a pair of FP32 values for the mantissa together with an i32 exponent. The reference orbit is rebased when necessary.

```text
z = Z + delta_z
c = C + delta_c
delta_z_next = 2*Z*delta_z + delta_z^2 + delta_c
```

The renderer estimates an upper bound on nonlinear error over the entire screen and can skip the initial iterations using a linear approximation. This is not a higher-order polynomial series approximation or a BLA table covering the full iteration range; it is a first-order approximation over the initial interval.

Once all pixels have completed computation, rendering stops even if the configured iteration limit has not yet been reached.

While interacting, the viewer uses reprojection of the existing image together with low-resolution rendering. After interaction stops, it switches to high-resolution rendering. GPU workloads are divided into short batches rather than being queued all at once.

## Limitations and Validation Status

The interface allows zoom levels up to 10^1000, but correctness and rendering speed are not guaranteed at every location.

Black pixels indicate points for which divergence was not detected before reaching the iteration limit. They do not constitute a proof that the point is inside the Mandelbrot set.

This renderer does not use rigorous interval arithmetic and does not provide formally guaranteed error bounds.

Node.js is used only to rerun the numerical tests. The viewer itself does not require Node.js.

```sh
node test_numeric.cjs
```

## References

- Claude Heiland-Allen, Deep zoom theory and practice (2021): https://mathr.co.uk/blog/2021-05-14_deep_zoom_theory_and_practice.html
- Claude Heiland-Allen, Deep zoom theory and practice (again) (2022): https://mathr.co.uk/blog/2022-02-21_deep_zoom_theory_and_practice_again.html
- WGSL specification: https://www.w3.org/TR/WGSL/
- WebGPU secure-context requirement: https://developer.mozilla.org/en-US/docs/Web/API/GPU
