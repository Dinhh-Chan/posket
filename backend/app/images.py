"""Image processing for uploads (pure functions on bytes / PIL images).

Every upload goes through the same steps: decode → apply EXIF orientation → flatten to RGB
(sRGB when the file carries an ICC profile) → centre-square crop → optional horizontal mirror →
resize → re-encode as JPEG without any metadata.
"""

from __future__ import annotations

import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError

PHOTO_MAX_SIDE = 1080
AVATAR_SIDE = 400
ANALYSIS_MAX_SIDE = 640
JPEG_QUALITY = 88
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_PIXELS = 60_000_000  # ~ 60 MP; anything larger is rejected rather than decoded
ALLOWED_FORMATS = frozenset({"JPEG", "MPO", "PNG", "WEBP"})  # MPO = multi-picture JPEG (phones)

_SRGB_PROFILE = ImageCms.createProfile("sRGB")


class InvalidImageError(ValueError):
    """The bytes are not a supported, decodable image."""


@dataclass(frozen=True)
class EncodedImage:
    data: bytes
    width: int
    height: int


def decode(data: bytes, min_side: int | None = None, color_manage: bool = True) -> Image.Image:
    """Decode an upload into an upright RGB image.

    `min_side` lets JPEG decoding skip resolution (DCT scaling) as long as both sides stay at
    least that large, which makes large camera files much cheaper to process.
    """
    if not data:
        raise InvalidImageError("empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise InvalidImageError("file too large")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            img = Image.open(io.BytesIO(data))
            if img.format not in ALLOWED_FORMATS:
                raise InvalidImageError(f"unsupported format {img.format}")
            if img.width * img.height > MAX_PIXELS:
                raise InvalidImageError("image too large")
            if min_side and img.format in ("JPEG", "MPO"):
                img.draft("RGB", (min_side, min_side))
            img.load()
            return _to_rgb(ImageOps.exif_transpose(img), color_manage)
    except InvalidImageError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, EOFError) as exc:
        raise InvalidImageError(str(exc)) from exc
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise InvalidImageError("image too large") from exc


def _to_rgb(img: Image.Image, color_manage: bool) -> Image.Image:
    icc = img.info.get("icc_profile") if color_manage else None
    has_alpha = img.mode in ("RGBA", "LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    if has_alpha:
        rgba = img.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        img = Image.alpha_composite(background, rgba).convert("RGB")
    if icc and img.mode in ("RGB", "CMYK", "L"):
        try:
            converted = ImageCms.profileToProfile(
                img, io.BytesIO(icc), _SRGB_PROFILE, outputMode="RGB"
            )
            if converted is not None:
                return converted
        except (ImageCms.PyCMSError, OSError, ValueError):
            pass  # unusable profile: fall back to a plain conversion
    return img if img.mode == "RGB" else img.convert("RGB")


def center_square(img: Image.Image) -> Image.Image:
    side = min(img.width, img.height)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    return img.crop((left, top, left + side, top + side))


def mirror(img: Image.Image) -> Image.Image:
    return ImageOps.mirror(img)


def fit_within(
    img: Image.Image, max_side: int, resample: Image.Resampling = Image.Resampling.LANCZOS
) -> Image.Image:
    """Downscale so the longest side is at most `max_side` (never upscales)."""
    longest = max(img.width, img.height)
    if longest <= max_side:
        return img
    scale = max_side / longest
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    return img.resize(size, resample, reducing_gap=3.0)


def encode_jpeg(img: Image.Image, quality: int = JPEG_QUALITY) -> EncodedImage:
    """Encode as baseline JPEG with no EXIF, ICC, comments or other metadata."""
    clean = img.copy()
    clean.info = {}
    buffer = io.BytesIO()
    clean.save(buffer, format="JPEG", quality=quality)
    return EncodedImage(data=buffer.getvalue(), width=clean.width, height=clean.height)


def square_from_upload(
    data: bytes,
    *,
    max_side: int,
    flip: bool = False,
    color_manage: bool = True,
    resample: Image.Resampling = Image.Resampling.LANCZOS,
) -> Image.Image:
    """Shared pipeline for photos, avatars and live analysis: upright, centre square, mirrored."""
    img = center_square(decode(data, min_side=max_side, color_manage=color_manage))
    if flip:
        img = mirror(img)
    return fit_within(img, max_side, resample)


def process_photo(data: bytes, flip: bool = False) -> EncodedImage:
    return encode_jpeg(square_from_upload(data, max_side=PHOTO_MAX_SIDE, flip=flip))


def process_avatar(data: bytes) -> EncodedImage:
    img = square_from_upload(data, max_side=AVATAR_SIDE)
    if img.width != AVATAR_SIDE:
        img = img.resize((AVATAR_SIDE, AVATAR_SIDE), Image.Resampling.LANCZOS)
    return encode_jpeg(img)


def prepare_for_analysis(data: bytes, flip: bool = False) -> Image.Image:
    """The square the user sees on screen, at most 640 px, ready for the detector."""
    return square_from_upload(
        data,
        max_side=ANALYSIS_MAX_SIDE,
        flip=flip,
        color_manage=False,
        resample=Image.Resampling.BILINEAR,
    )
