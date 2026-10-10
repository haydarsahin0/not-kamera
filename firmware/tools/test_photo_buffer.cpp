#include "../NotEkran/photo_buffer.h"
#include <cassert>
#include <iostream>
int main(){
 uint8_t storage[8]={};PhotoBuffer image{storage,sizeof(storage)};
 uint8_t first[]={0xff,0xd8,0,0x7f},last[]={1,2,3,4};
 assert(image.append(first,4));assert(image.append(last,4));assert(image.jpeg());assert(image.size==8);
 assert(!image.append(last,1));assert(!image.jpeg());assert(image.size==8);assert(storage[7]==4);
 PhotoBuffer missing{nullptr,8};assert(!missing.append(first,4));assert(!missing.jpeg());
 PhotoBuffer shortImage{storage,8};assert(shortImage.append(first,2));assert(!shortImage.jpeg());
 std::cout<<"PASS chunk boundaries, exact limit, overflow rejection, binary zero and incomplete images\n";
}
