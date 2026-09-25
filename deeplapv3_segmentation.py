import torch
from torchvision import models, transforms
from PIL import Image
import matplotlib.pyplot as plt

model = models.segmentation.deeplabv3_resnet101(weights="DEFAULT").eval()
preprocess = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],std=[0.229, 0.224, 0.225]),

])

img = Image.open("images/img.jpg").convert("RGB")
inp = preprocess(img).unsqueeze_(0)
with torch.no_grad():
    out = model(inp)["out"][0]
mask = out.argmax(0).byte().numpy()

plt.imshow(mask, cmap="inferno")
plt.axis("off")
plt.savefig("images_val/img_val.jpg", bbox_inches="tight", pad_inches=0)