from __future__ import annotations

import io

import pytest
from PIL import Image, ImageCms

from app import images

RED, BLUE, GREEN = (230, 20, 20), (20, 20, 230), (20, 200, 20)


def split_image(width: int, height: int, vertical: bool = True) -> Image.Image:
    """Left half red / right half blue (or top red / bottom blue when vertical=False)."""
    img = Image.new("RGB", (width, height), RED)
    box = (width // 2, 0, width, height) if vertical else (0, height // 2, width, height)
    img.paste(BLUE, box)
    return img


def encode(img: Image.Image, fmt: str = "JPEG", **kwargs: object) -> bytes:
    buffer = io.BytesIO()
    img.save(buffer, format=fmt, **kwargs)
    return buffer.getvalue()


def decode(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def is_close(pixel: tuple[int, ...], color: tuple[int, int, int], tolerance: int = 40) -> bool:
    return all(abs(a - b) <= tolerance for a, b in zip(pixel[:3], color, strict=True))


def test_center_square_crops_the_middle_of_landscape_and_portrait() -> None:
    landscape = Image.new("RGB", (300, 100), RED)
    landscape.paste(GREEN, (100, 0, 200, 100))
    square = images.center_square(landscape)
    assert square.size == (100, 100)
    assert square.getpixel((5, 50)) == GREEN and square.getpixel((95, 50)) == GREEN

    portrait = Image.new("RGB", (100, 301), RED)
    portrait.paste(GREEN, (0, 100, 100, 200))
    square = images.center_square(portrait)
    assert square.size == (100, 100)
    assert square.getpixel((50, 2)) == GREEN and square.getpixel((50, 97)) == GREEN


def test_mirror_flips_horizontally() -> None:
    flipped = images.mirror(split_image(100, 100))
    assert flipped.getpixel((10, 50)) == BLUE
    assert flipped.getpixel((90, 50)) == RED


def test_process_photo_mirror_flag() -> None:
    data = encode(split_image(400, 400))
    plain = decode(images.process_photo(data).data)
    mirrored = decode(images.process_photo(data, flip=True).data)
    assert is_close(plain.getpixel((20, 200)), RED) and is_close(plain.getpixel((380, 200)), BLUE)
    assert is_close(mirrored.getpixel((20, 200)), BLUE) and is_close(
        mirrored.getpixel((380, 200)), RED
    )


def test_exif_orientation_is_applied() -> None:
    # Stored landscape (left red, right blue) with Orientation=6: displayed rotated 90° clockwise,
    # i.e. portrait with red on top.
    exif = Image.Exif()
    exif[0x0112] = 6
    data = encode(split_image(400, 200), exif=exif.tobytes())

    upright = images.decode(data)
    assert upright.size == (200, 400)
    assert is_close(upright.getpixel((100, 20)), RED) and is_close(
        upright.getpixel((100, 380)), BLUE
    )

    photo = decode(images.process_photo(data).data)
    assert photo.size == (200, 200)
    assert is_close(photo.getpixel((100, 10)), RED) and is_close(photo.getpixel((100, 190)), BLUE)


def test_resize_limits() -> None:
    big = encode(Image.new("RGB", (4000, 3000), GREEN))
    assert images.process_photo(big).width == 1080
    assert images.process_photo(big).height == 1080
    assert images.prepare_for_analysis(big).size == (640, 640)
    small = encode(Image.new("RGB", (500, 700), GREEN))
    assert (images.process_photo(small).width, images.process_photo(small).height) == (500, 500)
    assert images.prepare_for_analysis(small).size == (500, 500)
    avatar = images.process_avatar(small)
    assert (avatar.width, avatar.height) == (400, 400)
    assert decode(images.process_avatar(big).data).size == (400, 400)


def test_fit_within_never_upscales() -> None:
    img = Image.new("RGB", (300, 200))
    assert images.fit_within(img, 1080) is img
    assert images.fit_within(img, 150).size == (150, 100)


def test_metadata_is_stripped() -> None:
    exif = Image.Exif()
    exif[0x010F] = "TestCam"  # Make
    exif[0x0110] = "Model X"  # Model
    exif[0x0112] = 1
    icc = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    data = encode(
        Image.new("RGB", (300, 200), GREEN), exif=exif.tobytes(), icc_profile=icc, comment=b"secret"
    )
    assert decode(data).getexif()  # the source really has metadata

    out = decode(images.process_photo(data).data)
    assert out.format == "JPEG"
    assert not out.getexif()
    assert "exif" not in out.info and "icc_profile" not in out.info and "comment" not in out.info


def test_jpeg_quality_and_mode() -> None:
    encoded = images.encode_jpeg(Image.new("RGB", (64, 64), GREEN))
    out = decode(encoded.data)
    assert out.mode == "RGB" and out.format == "JPEG"
    assert (encoded.width, encoded.height) == (64, 64)


def test_transparent_png_is_flattened_on_white() -> None:
    img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    out = decode(images.process_photo(encode(img, "PNG")).data)
    assert out.mode == "RGB"
    assert is_close(out.getpixel((50, 50)), (255, 255, 255), tolerance=5)


@pytest.mark.parametrize(
    "data",
    [
        b"",
        b"not an image at all",
        encode(Image.new("RGB", (10, 10)), "GIF"),
        encode(Image.new("RGB", (32, 32)))[:60],
    ],
    ids=["empty", "text", "gif", "truncated"],
)
def test_invalid_images_are_rejected(data: bytes) -> None:
    with pytest.raises(images.InvalidImageError):
        images.process_photo(data)
