import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { postMessage } from "@/components/network";

import { Message, Format, SubFormat } from "@/components/message";

import { useRef, useState } from "react";

interface Chat {
  origin: "user" | "chatbot";
  content: string;
  image?: string;
}

export function Playground() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Chat[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageBinary, setImageBinary] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (content) {
      const requestChat: Chat = {
        origin: "user",
        content: content,
        image: uploadedImage || undefined,
      };

      console.log(imageBinary);

      setMessages((prevMessages) => [...prevMessages, requestChat]);
      setInputValue("");
      setUploadedImage(null);
      setImageBinary(null);
      setImageType(null);

      try {
        const requestMsg: Message = {
          format: Format.Text,
          subformat: SubFormat.English,
          content: content,
        };

        if (imageBinary && imageType) {
          const imageMsg: Message = {
            format: Format.Binary,
            subformat: imageType.replace("image/", ""),
            content: imageBinary,
          };
          
          let Messages: Message[] = [imageMsg];
          requestMsg.submessages = Messages;
        }

        const response = await postMessage(requestMsg);

        const responseChat: Chat = {
          origin: "chatbot",
          content: response.content,
        };

        setMessages((prevMessages) => [...prevMessages, responseChat]);
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();

      const fileType = file.type;
      setImageType(fileType);

      reader.onload = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      const binaryReader = new FileReader();
      binaryReader.onload = () => {
        const binaryData = binaryReader.result as string;
        const base64String = btoa(binaryData);
        setImageBinary(base64String);
      };
      binaryReader.readAsBinaryString(file);
    }
  };

  const openImagePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const renderMessage = (chat: Chat) => {
    return (
      <div
        key={chat.content + (chat.image || "")}
        className="flex items-start space-x-2"
      >
        <div className="w-20 text-sm text-green-500">{chat.origin}</div>
        <div className="flex-1 border rounded-lg p-2">
          {chat.image && (
            <img src={chat.image} alt="Uploaded" className="w-64 h-auto mb-2" />
          )}
          <p className="text-black dark:text-white">{chat.content}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-4">
          {messages.map((message) => renderMessage(message))}
        </div>
      </div>
      <div className="border-t p-4 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <Input
            autoFocus
            className="flex-1"
            id="message-input"
            placeholder="Type a message"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === "Enter") {
                handleSendMessage();
              }
            }}
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          <Button onClick={openImagePicker}>Upload Image</Button>
          <Button onClick={handleSendMessage} type="submit">
            Send
          </Button>
        </div>
        {uploadedImage && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Uploaded image:
            </p>
            <img
              src={uploadedImage}
              alt="Preview"
              className="w-64 h-auto mt-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
