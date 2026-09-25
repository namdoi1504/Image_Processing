from ultralytics import YOLO
model = YOLO("yolo26n.pt")
results = model("images/img.jpg")
results[0].show()
results[0].save("images_val/img_val.jpg")