from ultralytics import YOLO
model = YOLO("yolo26n.pt")
results = model("images/cristiano.jpg")
results[0].show()
results[0].save("images_val/cristiano_val.jpg")